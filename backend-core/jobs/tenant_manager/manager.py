import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Protocol

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.common.utils import uuid_to_schema_name
from app.db.models import MigrationPhase
from app.db.schema_manager import ORG_SCHEMA_PATTERN
from app.services.encryption import EncryptionService
from jobs.tenant_manager.operations.encryption import EncryptionResult, decrypt_org_data, encrypt_org_data
from jobs.tenant_manager.operations.introspection import list_tenant_schemas
from jobs.tenant_manager.operations.migration import migrate_org_to_tenant
from jobs.tenant_manager.operations.rollback import migrate_org_from_tenant
from jobs.tenant_manager.operations.search_index import (
    CHAT_ATTRIBUTE_VALUE_SEARCH_INDEX,
    CHAT_MESSAGE_SEARCH_INDEX,
    NOTE_SEARCH_INDEX,
    SEARCH_INDEX_MODE_CREATE,
    SEARCH_INDEX_MODE_DROP,
    SEARCH_INDEX_MODE_REPLACE,
    SearchIndexResult,
    ensure_chat_attribute_value_search_function,
    ensure_chat_search_function,
    ensure_note_search_function,
    manage_chat_attribute_value_search_index,
    manage_chat_message_search_index,
    manage_note_search_index,
)
from jobs.tenant_manager.operations.validation import ValidationResult, validate_all_tenants, validate_org
from jobs.tenant_manager.utils import calculate_performance_metrics, log_org_progress, validate_worker_count

logger = logging.getLogger(__name__)

SearchIndexManager = Callable[..., SearchIndexResult]


@dataclass
class Organization:
    id: str
    name: str
    schema_name: str


class TenantDataProcessor(Protocol):
    def __call__(
        self,
        *,
        engine: Engine,
        org_id: str,
        schema: str,
        encryption_service: EncryptionService,
        batch_size: int,
        dry_run: bool,
    ) -> dict[str, EncryptionResult]: ...


@dataclass(frozen=True)
class SchemaDataOperation:
    label: str
    infinitive: str
    past_tense: str
    summary_label: str
    data_fn: TenantDataProcessor


ENCRYPTION_OPERATION = SchemaDataOperation(
    label="encryption",
    infinitive="encrypt",
    past_tense="encrypted",
    summary_label="ENCRYPTION",
    data_fn=encrypt_org_data,
)

DECRYPTION_OPERATION = SchemaDataOperation(
    label="decryption",
    infinitive="decrypt",
    past_tense="decrypted",
    summary_label="DECRYPTION",
    data_fn=decrypt_org_data,
)


class TenantManager:
    SCHEMA_PATTERN = ORG_SCHEMA_PATTERN

    def __init__(self, engine: Engine):
        self.engine = engine

    @staticmethod
    def _log_summary(lines: list[str]) -> None:
        logger.info("\n%s", "\n".join(lines))

    def get_all_organizations(self) -> list[Organization]:
        with self.engine.connect() as conn:
            rows = conn.execute(text('SELECT id::text, name FROM public."organization"')).fetchall()

        orgs: list[Organization] = []
        for row in rows:
            org_id, name = row
            schema_name = uuid_to_schema_name(org_id)
            orgs.append(Organization(id=org_id, name=name, schema_name=schema_name))

        return orgs

    def get_existing_tenant_schemas(self) -> list[str]:
        return [s for s in list_tenant_schemas(self.engine) if self.SCHEMA_PATTERN.match(s)]

    def validate_schema_name(self, schema_name: str) -> bool:
        return bool(self.SCHEMA_PATTERN.match(schema_name))

    def update_migration_status(self, org_id: str, phase: MigrationPhase, commit: bool = True) -> None:
        if not commit:
            return

        with self.engine.begin() as conn:
            org_name = conn.execute(
                text('SELECT "name" FROM public."organization" WHERE "id" = CAST(:org_id AS UUID)'),
                {"org_id": org_id},
            ).scalar()

            if not org_name:
                logger.warning("Organization not found: %s", org_id)
                return

            schema_name = uuid_to_schema_name(org_id)

            timestamp_col = {
                MigrationPhase.SCHEMA_CREATED: "schemaCreatedAt",
                MigrationPhase.DATA_COPIED: "dataCopiedAt",
                MigrationPhase.COMPLETED: "migrationCompletedAt",
            }.get(phase)

            timestamp_insert = f', "{timestamp_col}"' if timestamp_col else ""
            timestamp_value = ", NOW()" if timestamp_col else ""
            timestamp_update = f', "{timestamp_col}" = EXCLUDED."{timestamp_col}"' if timestamp_col else ""

            conn.execute(
                text(f"""
                    INSERT INTO public."organizationMigration"
                    ("organizationName", "schemaName", "currentPhase", "updatedAt"{timestamp_insert})
                    VALUES (:org_name, :schema_name, :phase, NOW(){timestamp_value})
                    ON CONFLICT ("schemaName") WHERE "schemaName" IS NOT NULL
                    DO UPDATE SET
                        "organizationName" = EXCLUDED."organizationName",
                        "currentPhase" = EXCLUDED."currentPhase",
                        "updatedAt" = EXCLUDED."updatedAt"
                        {timestamp_update}
                """),
                {"org_name": org_name, "schema_name": schema_name, "phase": phase.value},
            )

    def _migrate_single_org_to_tenant(
        self,
        org: Organization,
        source_schema: str,
        dry_run: bool,
    ) -> tuple[str, dict[str, int], float]:
        """Migrate a single organization to its tenant schema. Thread-safe."""
        start_time = datetime.now()
        org_prefix = f"[{org.name}]"

        logger.info("\n%s Starting migration (ID: %s) -> %s", org_prefix, org.id, org.schema_name)

        try:
            if not self.validate_schema_name(org.schema_name):
                logger.error("%s ! Invalid schema name: %s", org_prefix, org.schema_name)
                return org.name, {"error": -1}, 0.0

            table_results = migrate_org_to_tenant(
                engine=self.engine,
                org_name=org.name,
                org_id=org.id,
                source_schema=source_schema,
                target_schema=org.schema_name,
                dry_run=dry_run,
            )

            total_rows = sum(count for count in table_results.values() if count >= 0)
            error_count = sum(1 for count in table_results.values() if count < 0)

            for table, count in table_results.items():
                if count < 0:
                    logger.error("%s   ! %s: ERROR", org_prefix, table)
                else:
                    logger.info("%s   - %s: %s rows", org_prefix, table, count)

            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info("%s Completed: %s rows, %s errors, %.2fs", org_prefix, total_rows, error_count, elapsed)

            if not dry_run and error_count == 0:
                self.update_migration_status(org.id, MigrationPhase.DATA_COPIED, commit=not dry_run)

            return org.name, table_results, elapsed

        except Exception as e:
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.error("%s ! Error: %s (%.2fs)", org_prefix, e, elapsed)
            return org.name, {"error": -1}, elapsed

    def migrate_all_to_tenant_schemas(
        self,
        source_schema: str = "public_old",
        dry_run: bool = True,
        max_workers: int = 1,
        continue_on_error: bool = False,
    ) -> dict[str, dict[str, int]]:
        # Validate TENANT_TABLES configuration before starting migration
        from jobs.tenant_manager.operations.migration import validate_tenant_tables_config

        logger.info("Validating TENANT_TABLES configuration...")
        try:
            validate_tenant_tables_config(self.engine, source_schema)
        except ValueError as e:
            logger.error("Configuration validation failed: %s", e)
            return {}
        logger.info("TENANT_TABLES configuration valid")

        orgs = self.get_all_organizations()

        # Filter out already-migrated organizations (idempotency)
        if not dry_run:
            orgs_to_migrate: list[Organization] = []
            skipped_count = 0
            with self.engine.connect() as conn:
                for org in orgs:
                    status = conn.execute(
                        text(
                            'SELECT "currentPhase" FROM public."organizationMigration" WHERE "organizationName" = :name'
                        ),
                        {"name": org.name},
                    ).scalar()

                    if status == "DATA_COPIED":
                        logger.info("[%s] Already migrated (status: DATA_COPIED), skipping", org.name)
                        skipped_count += 1
                    else:
                        orgs_to_migrate.append(org)

            if skipped_count > 0:
                logger.info("Skipped %s already-migrated organization(s)", skipped_count)

            orgs = orgs_to_migrate

        results: dict[str, dict[str, int]] = {}
        timings: dict[str, float] = {}

        logger.info("Starting data migration for %s organizations from %s", len(orgs), source_schema)
        logger.info("Mode: %s", "DRY RUN" if dry_run else "COMMIT")

        # Validate and adjust worker count
        if max_workers > 1:
            max_workers = validate_worker_count(self.engine, max_workers)

        logger.info("Workers: %s (parallel: %s)", max_workers, "YES" if max_workers > 1 else "NO")
        logger.info("Continue on error: %s", "YES" if continue_on_error else "NO")

        overall_start = datetime.now()

        if max_workers == 1:
            # Sequential execution (original behavior)
            for org in orgs:
                org_name, org_results, elapsed = self._migrate_single_org_to_tenant(org, source_schema, dry_run)
                results[org_name] = org_results
                timings[org_name] = elapsed

                if not continue_on_error and "error" in org_results:
                    logger.error("\nStopping migration due to error in %s", org_name)
                    break
        else:
            # Parallel execution
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {
                    executor.submit(self._migrate_single_org_to_tenant, org, source_schema, dry_run): org
                    for org in orgs
                }

                for future in as_completed(futures):
                    org = futures[future]
                    try:
                        org_name, org_results, elapsed = future.result()
                        results[org_name] = org_results
                        timings[org_name] = elapsed

                        if not continue_on_error and "error" in org_results:
                            log_org_progress(org_name, "Stopping migration due to error")
                            # Cancel remaining futures
                            for f in futures:
                                f.cancel()
                            break
                    except Exception as e:
                        log_org_progress(org.name, f"Unexpected error: {e}")
                        results[org.name] = {"error": -1}
                        timings[org.name] = 0.0

                        if not continue_on_error:
                            log_org_progress(org.name, "Stopping migration due to error")
                            for f in futures:
                                f.cancel()
                            break

        overall_elapsed = (datetime.now() - overall_start).total_seconds()

        # Summary
        total_copied = sum(
            sum(count for count in org_results.values() if count >= 0) for org_results in results.values()
        )
        success_count = sum(1 for org_results in results.values() if "error" not in org_results)
        error_count = len(results) - success_count

        summary_lines = [
            "=" * 60,
            f"{'DRY RUN' if dry_run else 'MIGRATION'} Summary:",
            f"  Total organizations: {len(orgs)}",
            f"  Successful: {success_count}",
            f"  Failed: {error_count}",
            f"  Total rows: {total_copied}",
            f"  Total time: {overall_elapsed:.2f}s",
        ]
        if max_workers > 1:
            metrics = calculate_performance_metrics(timings)
            summary_lines.append(f"  Avg time per org: {metrics['average']:.2f}s")
            summary_lines.append(f"  Speedup: {metrics['speedup']:.2f}x")
        summary_lines.append("=" * 60)
        self._log_summary(summary_lines)

        return results

    def _migrate_single_org_from_tenant(
        self,
        org: Organization,
        target_schema: str,
        dry_run: bool,
        strict_counts: bool,
    ) -> tuple[str, dict[str, tuple[int, int]], float]:
        """Rollback a single organization from its tenant schema. Thread-safe."""
        start_time = datetime.now()
        org_prefix = f"[{org.name}]"

        logger.info("\n%s Starting rollback from %s", org_prefix, org.schema_name)

        try:
            if not self.validate_schema_name(org.schema_name):
                logger.error("%s ! Invalid schema name: %s", org_prefix, org.schema_name)
                return org.name, {"error": (-1, -1)}, 0.0

            existing_schemas = self.get_existing_tenant_schemas()
            if org.schema_name not in existing_schemas:
                logger.error("%s ! Tenant schema %s does not exist", org_prefix, org.schema_name)
                return org.name, {"error": (-1, -1)}, 0.0

            table_results = migrate_org_from_tenant(
                engine=self.engine,
                org_name=org.name,
                org_id=str(org.id),
                source_schema=org.schema_name,
                target_schema=target_schema,
                dry_run=dry_run,
                strict_counts=strict_counts,
            )

            total_tenant = sum(tenant for tenant, _ in table_results.values() if tenant >= 0)
            total_affected = sum(affected for _, affected in table_results.values() if affected >= 0)
            error_count = sum(1 for tenant, _ in table_results.values() if tenant < 0)

            for table, (tenant, affected) in table_results.items():
                if tenant < 0:
                    logger.error("%s   ! %s: ERROR", org_prefix, table)
                else:
                    logger.info("%s   - %s: tenant=%s, affected=%s", org_prefix, table, tenant, affected)

            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(
                "%s Completed: tenant=%s, affected=%s, errors=%s, %.2fs",
                org_prefix,
                total_tenant,
                total_affected,
                error_count,
                elapsed,
            )

            if not dry_run and error_count == 0:
                self.update_migration_status(
                    org.id, MigrationPhase.NOT_STARTED, notes="Rolled back from tenant schema", commit=not dry_run
                )

            return org.name, table_results, elapsed

        except Exception as e:
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.error("%s ! Error: %s (%.2fs)", org_prefix, e, elapsed)
            return org.name, {"error": (-1, -1)}, elapsed

    def migrate_all_back_to_public(
        self,
        target_schema: str = "public_old",
        dry_run: bool = True,
        strict_counts: bool = False,
        max_workers: int = 1,
        continue_on_error: bool = False,
    ) -> dict[str, dict[str, tuple[int, int]]]:
        orgs = self.get_all_organizations()
        results: dict[str, dict[str, tuple[int, int]]] = {}
        timings: dict[str, float] = {}

        logger.info("Starting rollback migration for %s organizations to %s", len(orgs), target_schema)
        logger.info("Mode: %s", "DRY RUN" if dry_run else "COMMIT")
        logger.info("Strict counts: %s", strict_counts)

        # Validate and adjust worker count
        if max_workers > 1:
            max_workers = validate_worker_count(self.engine, max_workers)

        logger.info("Workers: %s (parallel: %s)", max_workers, "YES" if max_workers > 1 else "NO")
        logger.info("Continue on error: %s", "YES" if continue_on_error else "NO")

        overall_start = datetime.now()

        if max_workers == 1:
            # Sequential execution (original behavior)
            for org in orgs:
                org_name, org_results, elapsed = self._migrate_single_org_from_tenant(
                    org, target_schema, dry_run, strict_counts
                )
                results[org_name] = org_results
                timings[org_name] = elapsed

                if not continue_on_error and "error" in org_results:
                    logger.error("\nStopping rollback due to error in %s", org_name)
                    break
        else:
            # Parallel execution
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {
                    executor.submit(
                        self._migrate_single_org_from_tenant, org, target_schema, dry_run, strict_counts
                    ): org
                    for org in orgs
                }

                for future in as_completed(futures):
                    org = futures[future]
                    try:
                        org_name, org_results, elapsed = future.result()
                        results[org_name] = org_results
                        timings[org_name] = elapsed

                        if not continue_on_error and "error" in org_results:
                            log_org_progress(org_name, "Stopping rollback due to error")
                            for f in futures:
                                f.cancel()
                            break
                    except Exception as e:
                        log_org_progress(org.name, f"Unexpected error: {e}")
                        results[org.name] = {"error": (-1, -1)}
                        timings[org.name] = 0.0

                        if not continue_on_error:
                            log_org_progress(org.name, "Stopping rollback due to error")
                            for f in futures:
                                f.cancel()
                            break

        overall_elapsed = (datetime.now() - overall_start).total_seconds()

        # Summary
        success_count = sum(1 for org_results in results.values() if "error" not in org_results)
        error_count = len(results) - success_count

        summary_lines = [
            "=" * 60,
            f"{'DRY RUN' if dry_run else 'ROLLBACK'} Summary:",
            f"  Total organizations: {len(orgs)}",
            f"  Successful: {success_count}",
            f"  Failed: {error_count}",
            f"  Total time: {overall_elapsed:.2f}s",
        ]
        if max_workers > 1:
            metrics = calculate_performance_metrics(timings)
            summary_lines.append(f"  Avg time per org: {metrics['average']:.2f}s")
            summary_lines.append(f"  Speedup: {metrics['speedup']:.2f}x")
        summary_lines.append("=" * 60)
        self._log_summary(summary_lines)

        return results

    def validate_all(self, deep: bool = False) -> tuple[bool, dict[str, dict[str, ValidationResult]]]:
        print("Starting validation for all tenant schemas")
        print(f"Deep validation: {deep}")

        results = validate_all_tenants(self.engine, source_schema="public_old", deep=deep)

        all_valid = True
        total_mismatches = 0

        for schema, table_results in results.items():
            logger.info("\n--- Validating schema: %s ---", schema)

            for table, result in table_results.items():
                if result.error:
                    if "does not exist" not in result.error:
                        logger.error("  ! Error validating %s: %s", table, result.error)
                        total_mismatches += 1
                        all_valid = False
                    continue

                if not result.is_valid:
                    if result.source_count != result.tenant_count:
                        logger.error(
                            "  ✗ Mismatch in %s: source=%s, tenant=%s",
                            table,
                            result.source_count,
                            result.tenant_count,
                        )
                        total_mismatches += 1
                        all_valid = False
                    elif deep and result.checksum_match is False:
                        logger.error("  ✗ %s: Checksum mismatch", table)
                        total_mismatches += 1
                        all_valid = False
                else:
                    logger.info("  ✓ %s: %s rows match", table, result.tenant_count)
                    if deep and result.checksum_match:
                        logger.info("    ✓ Checksum match")

        if all_valid:
            logger.info("\n✓ All tenant schemas validated successfully")
        else:
            logger.error("\n✗ Validation failed with %s mismatches", total_mismatches)

        return all_valid, results

    def validate_single_org(self, org_name: str, deep: bool = False) -> tuple[bool, dict[str, ValidationResult]]:
        orgs = self.get_all_organizations()
        org = next((o for o in orgs if o.name == org_name), None)

        if not org:
            raise ValueError(f"Organization '{org_name}' not found")

        logger.info("Validating %s (schema: %s)", org.name, org.schema_name)
        logger.info("Deep validation: %s", deep)

        if not self.validate_schema_name(org.schema_name):
            raise ValueError(f"Invalid schema name: {org.schema_name}")

        existing_schemas = self.get_existing_tenant_schemas()
        if org.schema_name not in existing_schemas:
            raise ValueError(f"Tenant schema {org.schema_name} does not exist")

        results = validate_org(self.engine, org.name, org.schema_name, source_schema="public_old", deep=deep)

        all_valid = True
        for table, result in results.items():
            if result.error:
                if "does not exist" not in result.error:
                    logger.warning("SKIP %s: %s", table, result.error)
                continue

            if not result.is_valid:
                if result.source_count != result.tenant_count:
                    logger.error(
                        "MISMATCH %s COUNT: source=%s tenant=%s", table, result.source_count, result.tenant_count
                    )
                    all_valid = False
                elif deep and result.checksum_match is False:
                    logger.error("MISMATCH %s CHECKSUM", table)
                    all_valid = False
            else:
                logger.info("OK %s COUNT: %s", table, result.source_count)
                if deep and result.checksum_match:
                    logger.info("  ✓ CHECKSUM MATCH")

        if all_valid:
            logger.info("\n✓ Validation passed")
        else:
            logger.error("\n✗ Validation failed")

        return True, results

    def _process_single_org(
        self,
        org: Organization,
        encryption_service: EncryptionService,
        batch_size: int,
        dry_run: bool,
        operation: SchemaDataOperation,
        inter_batch_sleep_seconds: float = 0.0,
    ) -> tuple[str, dict[str, EncryptionResult], float]:
        """Process a single tenant schema data operation. Thread-safe."""
        start_time = datetime.now()
        org_prefix = f"[{org.name}]"

        logger.info("\n%s Starting %s (ID: %s) in %s", org_prefix, operation.label, org.id, org.schema_name)

        try:
            if not self.validate_schema_name(org.schema_name):
                logger.error("%s ! Invalid schema name: %s", org_prefix, org.schema_name)
                error_result = EncryptionResult(
                    table="_error", total_rows=0, processed_count=0, error_count=1, error="Invalid schema name"
                )
                return org.name, {"_error": error_result}, 0.0

            existing_schemas = self.get_existing_tenant_schemas()
            if org.schema_name not in existing_schemas:
                logger.warning("%s ! Tenant schema %s does not exist, skipping", org_prefix, org.schema_name)
                return org.name, {}, 0.0

            table_results = operation.data_fn(
                engine=self.engine,
                org_id=org.id,
                schema=org.schema_name,
                encryption_service=encryption_service,
                batch_size=batch_size,
                dry_run=dry_run,
                inter_batch_sleep_seconds=inter_batch_sleep_seconds,
            )

            total_processed = sum(r.processed_count for r in table_results.values())
            total_rows = sum(r.total_rows for r in table_results.values())
            total_errors = sum(r.error_count for r in table_results.values())

            for table, result in table_results.items():
                if result.error:
                    logger.error("%s   ! %s: ERROR - %s", org_prefix, table, result.error)
                elif dry_run:
                    logger.info("%s   - %s: %s rows to %s", org_prefix, table, result.total_rows, operation.infinitive)
                else:
                    logger.info(
                        "%s   - %s: %s/%s %s",
                        org_prefix,
                        table,
                        result.processed_count,
                        result.total_rows,
                        operation.past_tense,
                    )

            elapsed = (datetime.now() - start_time).total_seconds()

            if dry_run:
                logger.info("%s Completed: %s rows to %s, %.2fs", org_prefix, total_rows, operation.infinitive, elapsed)
            else:
                logger.info(
                    "%s Completed: %s %s, %s errors, %.2fs",
                    org_prefix,
                    total_processed,
                    operation.past_tense,
                    total_errors,
                    elapsed,
                )

            return org.name, table_results, elapsed

        except Exception as e:
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.error("%s ! Error: %s (%.2fs)", org_prefix, e, elapsed)
            error_result = EncryptionResult(
                table="_error", total_rows=0, processed_count=0, error_count=1, error=str(e)
            )
            return org.name, {"_error": error_result}, elapsed

    def _process_all_schemas(
        self,
        encryption_service: EncryptionService,
        dry_run: bool,
        max_workers: int,
        batch_size: int,
        continue_on_error: bool,
        operation: SchemaDataOperation,
        inter_batch_sleep_seconds: float = 0.0,
    ) -> dict[str, dict[str, EncryptionResult]]:
        """Process a tenant schema data operation across all organizations."""

        orgs = self.get_all_organizations()
        results: dict[str, dict[str, EncryptionResult]] = {}
        timings: dict[str, float] = {}

        logger.info("Starting %s for %s organizations", operation.label, len(orgs))
        logger.info("Mode: %s", "DRY RUN" if dry_run else "COMMIT")
        logger.info("Batch size: %s", batch_size)

        if max_workers > 1:
            max_workers = validate_worker_count(self.engine, max_workers)

        logger.info("Workers: %s (parallel: %s)", max_workers, "YES" if max_workers > 1 else "NO")
        logger.info("Continue on error: %s", "YES" if continue_on_error else "NO")

        overall_start = datetime.now()

        if max_workers == 1:
            for org in orgs:
                org_name, org_results, elapsed = self._process_single_org(
                    org, encryption_service, batch_size, dry_run, operation, inter_batch_sleep_seconds
                )
                results[org_name] = org_results
                timings[org_name] = elapsed

                if not continue_on_error and "_error" in org_results:
                    logger.error("\nStopping %s due to error in %s", operation.label, org_name)
                    break
        else:
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {
                    executor.submit(
                        self._process_single_org,
                        org,
                        encryption_service,
                        batch_size,
                        dry_run,
                        operation,
                        inter_batch_sleep_seconds,
                    ): org
                    for org in orgs
                }

                for future in as_completed(futures):
                    org = futures[future]
                    try:
                        org_name, org_results, elapsed = future.result()
                        results[org_name] = org_results
                        timings[org_name] = elapsed

                        if not continue_on_error and "_error" in org_results:
                            log_org_progress(org_name, f"Stopping {operation.label} due to error")
                            for f in futures:
                                f.cancel()
                            break
                    except Exception as e:
                        log_org_progress(org.name, f"Unexpected error: {e}")
                        error_result = EncryptionResult(
                            table="_error", total_rows=0, processed_count=0, error_count=1, error=str(e)
                        )
                        results[org.name] = {"_error": error_result}
                        timings[org.name] = 0.0

                        if not continue_on_error:
                            log_org_progress(org.name, f"Stopping {operation.label} due to error")
                            for f in futures:
                                f.cancel()
                            break

        overall_elapsed = (datetime.now() - overall_start).total_seconds()

        # Summary
        total_processed = sum(sum(r.processed_count for r in org_results.values()) for org_results in results.values())
        total_rows = sum(sum(r.total_rows for r in org_results.values()) for org_results in results.values())
        total_errors = sum(sum(r.error_count for r in org_results.values()) for org_results in results.values())
        success_count = sum(1 for org_results in results.values() if "_error" not in org_results)
        error_count = len(results) - success_count

        summary_lines = [
            "=" * 60,
            f"{'DRY RUN' if dry_run else operation.summary_label} Summary:",
            f"  Total organizations: {len(orgs)}",
            f"  Successful: {success_count}",
            f"  Failed: {error_count}",
        ]
        if dry_run:
            summary_lines.append(f"  Total rows to {operation.infinitive}: {total_rows}")
        else:
            summary_lines.append(f"  Total rows {operation.past_tense}: {total_processed}")
            summary_lines.append(f"  Total row errors: {total_errors}")
        summary_lines.append(f"  Total time: {overall_elapsed:.2f}s")
        if max_workers > 1:
            metrics = calculate_performance_metrics(timings)
            summary_lines.append(f"  Avg time per org: {metrics['average']:.2f}s")
            summary_lines.append(f"  Speedup: {metrics['speedup']:.2f}x")

        degraded = [
            (org, r.table)
            for org, org_results in results.items()
            for r in org_results.values()
            if r.backfill_index_valid is False
        ]
        if degraded:
            summary_lines.append(f"  Tables with missing/invalid backfill index: {len(degraded)}")
            for org, table in degraded:
                summary_lines.append(f"    - {org}.{table}")

        incomplete = [
            (org, r.table, "sweep-exhausted" if r.sweep_exhausted else "rows-remaining")
            for org, org_results in results.items()
            for r in org_results.values()
            if r.sweep_exhausted or r.rows_remaining
        ]
        if incomplete:
            summary_lines.append(f"  Tables with incomplete backfill: {len(incomplete)}")
            for org, table, reason in incomplete:
                summary_lines.append(f"    - {org}.{table} ({reason})")

        summary_lines.append("=" * 60)
        self._log_summary(summary_lines)

        return results

    def _encrypt_single_org(
        self,
        org: Organization,
        encryption_service: EncryptionService,
        batch_size: int,
        dry_run: bool,
    ) -> tuple[str, dict[str, EncryptionResult], float]:
        """Encrypt unencrypted data for a single organization. Thread-safe."""
        return self._process_single_org(
            org,
            encryption_service,
            batch_size,
            dry_run,
            ENCRYPTION_OPERATION,
        )

    def encrypt_all_schemas(
        self,
        encryption_service: EncryptionService,
        dry_run: bool = True,
        max_workers: int = 1,
        batch_size: int = 100,
        continue_on_error: bool = False,
        inter_batch_sleep_seconds: float = 0.0,
    ) -> dict[str, dict[str, EncryptionResult]]:
        """Encrypt unencrypted data across all tenant schemas.

        Iterates all organizations, finds rows with isEncrypted=false in
        chatMessage, note, and chatAttributeValue tables, and encrypts them
        using the EncryptionService with per-org key derivation.
        """
        return self._process_all_schemas(
            encryption_service,
            dry_run,
            max_workers,
            batch_size,
            continue_on_error,
            ENCRYPTION_OPERATION,
            inter_batch_sleep_seconds,
        )

    def _decrypt_single_org(
        self,
        org: Organization,
        encryption_service: EncryptionService,
        batch_size: int,
        dry_run: bool,
    ) -> tuple[str, dict[str, EncryptionResult], float]:
        """Decrypt encrypted data for a single organization. Thread-safe."""
        return self._process_single_org(
            org,
            encryption_service,
            batch_size,
            dry_run,
            DECRYPTION_OPERATION,
        )

    def decrypt_all_schemas(
        self,
        encryption_service: EncryptionService,
        dry_run: bool = True,
        max_workers: int = 1,
        batch_size: int = 100,
        continue_on_error: bool = False,
        inter_batch_sleep_seconds: float = 0.0,
    ) -> dict[str, dict[str, EncryptionResult]]:
        """Decrypt encrypted data across all tenant schemas.

        Iterates all organizations, finds rows with isEncrypted=true in
        chatMessage, note, and chatAttributeValue tables, and decrypts them
        using the EncryptionService with per-org key derivation. Decrypted
        data is stored as raw UTF-8 bytes with isEncrypted=false.
        """
        return self._process_all_schemas(
            encryption_service,
            dry_run,
            max_workers,
            batch_size,
            continue_on_error,
            DECRYPTION_OPERATION,
            inter_batch_sleep_seconds,
        )

    _SEARCH_INDEX_ROW_LABEL: dict[str, str] = {
        "chatMessage": "encrypted TEXT messages",
        "note": "encrypted notes",
        "chatAttributeValue": "encrypted chat attribute values",
    }

    def _format_search_index_message(self, result: SearchIndexResult, dry_run: bool, mode: str) -> str:
        row_label = self._SEARCH_INDEX_ROW_LABEL.get(result.table, "encrypted rows")
        if mode == SEARCH_INDEX_MODE_DROP:
            if dry_run:
                return "would remove" if result.already_exists else "already absent"
            return "removed" if result.removed else "already absent"

        if mode == SEARCH_INDEX_MODE_REPLACE:
            if dry_run:
                action = "would replace" if result.already_exists else "would create"
            else:
                action = "replaced" if result.already_exists else "created"
            return f"{action} for {result.encrypted_row_count} {row_label}"

        if dry_run:
            if result.already_exists:
                return "already exists"
            return f"would create for {result.encrypted_row_count} {row_label}"

        if result.already_exists and not result.created:
            return "already exists"
        return f"created for {result.encrypted_row_count} {row_label}"

    def _search_index_managers(self) -> list[tuple[str, str, SearchIndexManager]]:
        return [
            ("chatMessage", CHAT_MESSAGE_SEARCH_INDEX, manage_chat_message_search_index),
            ("note", NOTE_SEARCH_INDEX, manage_note_search_index),
            ("chatAttributeValue", CHAT_ATTRIBUTE_VALUE_SEARCH_INDEX, manage_chat_attribute_value_search_index),
        ]

    def _manage_chat_search_index_single_org(
        self,
        org: Organization,
        encryption_service: EncryptionService,
        dry_run: bool,
        mode: str,
    ) -> tuple[str, list[SearchIndexResult], float]:
        start_time = datetime.now()
        org_prefix = f"[{org.name}]"
        action_label = {
            SEARCH_INDEX_MODE_CREATE: "search index setup",
            SEARCH_INDEX_MODE_REPLACE: "search index refresh",
            SEARCH_INDEX_MODE_DROP: "search index removal",
        }[mode]

        logger.info("\n%s Starting %s (ID: %s) in %s", org_prefix, action_label, org.id, org.schema_name)

        managers = self._search_index_managers()

        if not self.validate_schema_name(org.schema_name):
            results = [
                SearchIndexResult(
                    schema=org.schema_name,
                    index_name=index_name,
                    encrypted_row_count=0,
                    created=False,
                    already_exists=False,
                    action=mode,
                    error="Invalid schema name",
                    table=table_name,
                )
                for table_name, index_name, _ in managers
            ]
            return org.name, results, 0.0

        existing_schemas = self.get_existing_tenant_schemas()
        if org.schema_name not in existing_schemas:
            logger.warning("%s ! Tenant schema %s does not exist, skipping", org_prefix, org.schema_name)
            results = [
                SearchIndexResult(
                    schema=org.schema_name,
                    index_name=index_name,
                    encrypted_row_count=0,
                    created=False,
                    already_exists=False,
                    action=mode,
                    table=table_name,
                )
                for table_name, index_name, _ in managers
            ]
            return org.name, results, 0.0

        results: list[SearchIndexResult] = []
        for table_name, index_name, manager_fn in managers:
            try:
                result = manager_fn(
                    engine=self.engine,
                    org_id=org.id,
                    schema=org.schema_name,
                    encryption_service=encryption_service,
                    dry_run=dry_run,
                    mode=mode,
                )
            except Exception as e:
                logger.error("%s ! Error managing %s search index: %s", org_prefix, table_name, e)
                result = SearchIndexResult(
                    schema=org.schema_name,
                    index_name=index_name,
                    encrypted_row_count=0,
                    created=False,
                    already_exists=False,
                    action=mode,
                    error=str(e),
                    table=table_name,
                )

            if result.error:
                logger.error("%s   ! %s: ERROR - %s", org_prefix, result.index_name, result.error)
            else:
                logger.info(
                    "%s   - %s: %s",
                    org_prefix,
                    result.index_name,
                    self._format_search_index_message(result, dry_run, mode),
                )
            results.append(result)

        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info("%s Completed %s in %.2fs", org_prefix, action_label, elapsed)
        return org.name, results, elapsed

    def _create_chat_search_index_single_org(
        self,
        org: Organization,
        encryption_service: EncryptionService,
        dry_run: bool,
    ) -> tuple[str, list[SearchIndexResult], float]:
        return self._manage_chat_search_index_single_org(
            org,
            encryption_service,
            dry_run,
            SEARCH_INDEX_MODE_CREATE,
        )

    def create_chat_search_indexes(
        self,
        encryption_service: EncryptionService,
        dry_run: bool = True,
        max_workers: int = 1,
        continue_on_error: bool = False,
        mode: str = SEARCH_INDEX_MODE_CREATE,
    ) -> dict[str, SearchIndexResult]:
        orgs = self.get_all_organizations()
        results: dict[str, SearchIndexResult] = {}
        timings: dict[str, float] = {}

        if mode not in (SEARCH_INDEX_MODE_CREATE, SEARCH_INDEX_MODE_REPLACE, SEARCH_INDEX_MODE_DROP):
            raise ValueError(f"Unsupported search index mode: {mode}")

        if mode != SEARCH_INDEX_MODE_DROP:
            ensure_chat_search_function(self.engine)
            ensure_note_search_function(self.engine)
            ensure_chat_attribute_value_search_function(self.engine)

        operation_label = {
            SEARCH_INDEX_MODE_CREATE: "search index setup",
            SEARCH_INDEX_MODE_REPLACE: "search index refresh",
            SEARCH_INDEX_MODE_DROP: "search index removal",
        }[mode]

        logger.info("Starting %s for %s organizations", operation_label, len(orgs))
        logger.info("Mode: %s", "DRY RUN" if dry_run else "COMMIT")

        if max_workers > 1:
            max_workers = validate_worker_count(self.engine, max_workers)

        logger.info("Workers: %s (parallel: %s)", max_workers, "YES" if max_workers > 1 else "NO")
        logger.info("Continue on error: %s", "YES" if continue_on_error else "NO")

        overall_start = datetime.now()

        def process_org(org: Organization) -> tuple[str, list[SearchIndexResult], float]:
            if mode == SEARCH_INDEX_MODE_CREATE:
                return self._create_chat_search_index_single_org(org, encryption_service, dry_run)
            return self._manage_chat_search_index_single_org(org, encryption_service, dry_run, mode)

        def record_results(org_name: str, org_results: list[SearchIndexResult]) -> bool:
            had_error = False
            for r in org_results:
                results[f"{org_name}:{r.table}"] = r
                if r.error:
                    had_error = True
            return had_error

        if max_workers == 1:
            for org in orgs:
                org_name, org_results, elapsed = process_org(org)
                had_error = record_results(org_name, org_results)
                timings[org_name] = elapsed

                if not continue_on_error and had_error:
                    logger.error("\nStopping %s due to error in %s", operation_label, org_name)
                    break
        else:
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {executor.submit(process_org, org): org for org in orgs}

                for future in as_completed(futures):
                    org = futures[future]
                    try:
                        org_name, org_results, elapsed = future.result()
                        had_error = record_results(org_name, org_results)
                        timings[org_name] = elapsed

                        if not continue_on_error and had_error:
                            log_org_progress(org_name, f"Stopping {operation_label} due to error")
                            for f in futures:
                                f.cancel()
                            break
                    except Exception as e:
                        log_org_progress(org.name, f"Unexpected error: {e}")
                        for table_name, index_name, _ in self._search_index_managers():
                            results[f"{org.name}:{table_name}"] = SearchIndexResult(
                                schema=org.schema_name,
                                index_name=index_name,
                                encrypted_row_count=0,
                                created=False,
                                already_exists=False,
                                action=mode,
                                error=str(e),
                                table=table_name,
                            )
                        timings[org.name] = 0.0

                        if not continue_on_error:
                            log_org_progress(org.name, f"Stopping {operation_label} due to error")
                            for f in futures:
                                f.cancel()
                            break

        overall_elapsed = (datetime.now() - overall_start).total_seconds()
        error_count = sum(1 for result in results.values() if result.error)

        summary_title = {
            SEARCH_INDEX_MODE_CREATE: "SEARCH INDEX",
            SEARCH_INDEX_MODE_REPLACE: "SEARCH INDEX REFRESH",
            SEARCH_INDEX_MODE_DROP: "SEARCH INDEX REMOVAL",
        }[mode]
        summary_lines = [
            "=" * 60,
            f"{'DRY RUN' if dry_run else summary_title} Summary:",
            f"  Total organizations: {len(orgs)}",
            f"  Total indexes evaluated: {len(results)}",
        ]

        if mode == SEARCH_INDEX_MODE_DROP:
            removable_count = sum(1 for result in results.values() if result.already_exists and not result.error)
            removed_count = sum(1 for result in results.values() if result.removed)
            absent_count = sum(1 for result in results.values() if not result.already_exists and not result.error)
            summary_lines.append(
                f"  {'Would remove' if dry_run else 'Removed'}: {removable_count if dry_run else removed_count}"
            )
            summary_lines.append(f"  Already absent: {absent_count}")
        elif mode == SEARCH_INDEX_MODE_REPLACE:
            replace_count = sum(1 for result in results.values() if result.already_exists and not result.error)
            create_count = sum(1 for result in results.values() if not result.already_exists and not result.error)
            replaced_count = sum(1 for result in results.values() if result.created and result.already_exists)
            created_count = sum(1 for result in results.values() if result.created and not result.already_exists)
            summary_lines.append(
                f"  {'Would replace' if dry_run else 'Replaced'}: {replace_count if dry_run else replaced_count}"
            )
            summary_lines.append(
                f"  {'Would create' if dry_run else 'Created'}: {create_count if dry_run else created_count}"
            )
        else:
            created_count = sum(1 for result in results.values() if result.created)
            pending_count = sum(
                1
                for result in results.values()
                if not result.created and not result.already_exists and not result.error
            )
            existing_count = sum(1 for result in results.values() if result.already_exists and not result.created)
            summary_lines.append(
                f"  {'Would create' if dry_run else 'Created'}: {pending_count if dry_run else created_count}"
            )
            summary_lines.append(f"  Already exists: {existing_count}")

        summary_lines.append(f"  Failed: {error_count}")
        summary_lines.append(f"  Total time: {overall_elapsed:.2f}s")
        if max_workers > 1:
            metrics = calculate_performance_metrics(timings)
            summary_lines.append(f"  Avg time per org: {metrics['average']:.2f}s")
            summary_lines.append(f"  Speedup: {metrics['speedup']:.2f}x")
        summary_lines.append("=" * 60)
        self._log_summary(summary_lines)

        return results
