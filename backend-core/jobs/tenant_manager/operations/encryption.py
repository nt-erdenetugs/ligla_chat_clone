import logging
import time
from dataclasses import dataclass

from sqlalchemy import TextClause, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import DBAPIError, OperationalError

from app.db.encryption_constants import SET_ORG_KEY_SQL
from app.services.encryption import EncryptionService
from jobs.tenant_manager.operations.introspection import (
    drop_index_if_invalid,
    get_pk_or_unique_columns,
    table_exists,
)

# TODO(JIRA-922): once the cleanup release drops the plaintext columns and renames
# *Encrypted -> original, this backfill module is obsolete and can be removed.

logger = logging.getLogger(__name__)

# Transaction-scoped try-lock: acquired inside each batch transaction and released
# automatically when that transaction commits — no long-lived lock connection.
TENANT_OPERATION_TRY_XACT_LOCK_SQL = text("SELECT pg_try_advisory_xact_lock(hashtext(:lock_name))")

BATCH_RETRY_MAX_ATTEMPTS = 3
BATCH_RETRY_BASE_DELAY_SECONDS = 0.5
BATCH_RETRY_BACKOFF_BASE = 2


def _is_transient_db_error(exc: Exception) -> bool:
    """Heuristic: retry on connection drops, deadlocks, and serialization failures."""
    if isinstance(exc, OperationalError):
        return True
    if isinstance(exc, DBAPIError):
        message = str(getattr(exc, "orig", exc)).lower()
        return any(marker in message for marker in ("deadlock", "could not serialize", "connection", "ssl", "timeout"))
    return False


@dataclass
class EncryptionTarget:
    """A table whose encrypted column the backfill populates.

    The backfill reads `plaintext_column` and writes `encrypted_column` for every row
    whose encrypted column is still NULL. `plaintext_to_text_expr` casts the plaintext
    to text (JSONB needs `::text`, TEXT/VARCHAR do not).

    `row_encrypt_predicate` is an optional SQL boolean (it may reference `target_table`
    and use `{schema}`). When set, only rows matching it are encrypted; the rest get
    plain UTF-8 bytes. When None, every row is encrypted.

    `backfill_index_name` is the partial queue index the job creates CONCURRENTLY to
    keep the batch loop's `ORDER BY id` + row filter index-driven.
    """

    table: str
    plaintext_column: str
    encrypted_column: str
    plaintext_to_text_expr: str
    row_encrypt_predicate: str | None = None
    backfill_index_name: str = ""


# chatAttributeValue is encrypted per-attribute (client design): only rows whose
# attribute has isEncryptionEnabled = true are encrypted; the rest are stored as
# plain bytes so the encrypted column is still populated for every row.
#
# NOTE: the encrypt-direction backfill selects `valueEncrypted IS NULL`, so once a
# row's encrypted column is populated it is never revisited. Enabling encryption on
# an attribute that already has rows would therefore NOT re-encrypt them. This is
# safe only because attribute.isEncryptionEnabled is locked once values exist.
CHAT_ATTRIBUTE_VALUE_ENCRYPT_PREDICATE_SQL = (
    "EXISTS ("
    'SELECT 1 FROM "{schema}"."attribute" a '
    'WHERE a."id" = target_table."attributeId" '
    'AND a."isEncryptionEnabled" = true'
    ")"
)


ENCRYPTION_TARGETS = [
    EncryptionTarget(
        table="chatMessage",
        plaintext_column="content",
        encrypted_column="contentEncrypted",
        plaintext_to_text_expr='target_table."content"::text',
        backfill_index_name="idx_chat_message_needs_backfill",
    ),
    EncryptionTarget(
        table="note",
        plaintext_column="noteValue",
        encrypted_column="noteValueEncrypted",
        plaintext_to_text_expr='target_table."noteValue"',
        backfill_index_name="idx_note_needs_backfill",
    ),
    EncryptionTarget(
        table="chatAttributeValue",
        plaintext_column="value",
        encrypted_column="valueEncrypted",
        plaintext_to_text_expr='target_table."value"',
        row_encrypt_predicate=CHAT_ATTRIBUTE_VALUE_ENCRYPT_PREDICATE_SQL,
        backfill_index_name="idx_chat_attribute_value_needs_backfill",
    ),
]


@dataclass
class EncryptionResult:
    """Result of an encrypt or decrypt operation for a single table."""

    table: str
    total_rows: int
    processed_count: int
    error_count: int
    error: str | None = None
    backfill_index_valid: bool | None = None
    sweep_exhausted: bool = False
    rows_remaining: bool = False

    @property
    def is_success(self) -> bool:
        return self.error is None and self.error_count == 0 and not self.sweep_exhausted and not self.rows_remaining


@dataclass(frozen=True)
class BatchOperationConfig:
    """A bound, table-specific batch transition.

    `select_predicate` is the SQL (referencing `target_table`) that picks the rows
    still needing work. `encrypted_column_set_expr` / `is_encrypted_set_expr` are
    the SQL assigned to the encrypted column and the isEncrypted flag.
    """

    select_predicate: str
    progress_label: str
    encrypted_column_set_expr: str
    is_encrypted_set_expr: str


def build_encrypt_config(target: EncryptionTarget, schema: str) -> BatchOperationConfig:
    """Build the encrypt-direction config for one table.

    Always-encrypted tables (no `row_encrypt_predicate`) must also re-process the
    plain-byte rows an old keyless instance can leave behind, so they select on
    `isEncrypted = false`. Per-attribute tables keep plain-byte rows as a valid
    final state, so they select only rows whose encrypted column is still NULL.
    """
    encrypt_expr = (
        f"pgp_sym_encrypt({target.plaintext_to_text_expr}, current_setting('app.organizationKey', true), 's2k-mode=0')"
    )
    plain_expr = f"convert_to({target.plaintext_to_text_expr}, 'UTF8')"

    if target.row_encrypt_predicate is None:
        return BatchOperationConfig(
            select_predicate='target_table."isEncrypted" = false',
            progress_label="encrypted",
            encrypted_column_set_expr=encrypt_expr,
            is_encrypted_set_expr="true",
        )

    predicate = target.row_encrypt_predicate.format(schema=schema)
    return BatchOperationConfig(
        select_predicate=f'target_table."{target.encrypted_column}" IS NULL',
        progress_label="encrypted",
        encrypted_column_set_expr=f"CASE WHEN {predicate} THEN {encrypt_expr} ELSE {plain_expr} END",
        is_encrypted_set_expr=f"CASE WHEN {predicate} THEN true ELSE false END",
    )


def build_decrypt_config(target: EncryptionTarget) -> BatchOperationConfig:
    """Build the decrypt-direction (rollback) config: NULL the encrypted column.

    Safe because the plaintext column still holds the authoritative value for
    every row until the cleanup release.
    """
    return BatchOperationConfig(
        select_predicate=f'target_table."{target.encrypted_column}" IS NOT NULL',
        progress_label="decrypted",
        encrypted_column_set_expr="NULL",
        is_encrypted_set_expr="false",
    )


@dataclass
class _BatchOutcome:
    """Outcome of one backfill batch attempt."""

    updated_rows: int
    error: Exception | None
    contended: bool
    last_id: str | None = None


def _run_one_batch(
    *,
    engine: Engine,
    lock_name: str,
    organization_key: str,
    update_sql: TextClause,
    params: dict,
    progress_label: str,
    schema: str,
    table: str,
) -> _BatchOutcome:
    """Run one backfill batch in a transaction, retrying transient errors.

    Returns (updated_rows, max_id) so callers can advance a keyset cursor.
    """
    last_error: Exception | None = None
    for attempt in range(1, BATCH_RETRY_MAX_ATTEMPTS + 1):
        try:
            with engine.begin() as conn:
                if not conn.execute(TENANT_OPERATION_TRY_XACT_LOCK_SQL, {"lock_name": lock_name}).scalar():
                    return _BatchOutcome(updated_rows=0, error=None, contended=True)
                conn.execute(SET_ORG_KEY_SQL, {"organization_key": organization_key})
                row = conn.execute(update_sql, params).first()
            updated_rows = int(row[0] or 0) if row is not None else 0
            max_id = str(row[1]) if row is not None and row[1] is not None else None
            return _BatchOutcome(updated_rows=updated_rows, error=None, contended=False, last_id=max_id)
        except Exception as e:
            last_error = e
            if attempt < BATCH_RETRY_MAX_ATTEMPTS and _is_transient_db_error(e):
                delay = BATCH_RETRY_BASE_DELAY_SECONDS * (BATCH_RETRY_BACKOFF_BASE ** (attempt - 1))
                logger.warning(
                    "Transient error on %s batch for %s.%s (attempt %s/%s): %s — retrying in %.2fs",
                    progress_label,
                    schema,
                    table,
                    attempt,
                    BATCH_RETRY_MAX_ATTEMPTS,
                    e,
                    delay,
                )
                time.sleep(delay)
                continue
            break
    return _BatchOutcome(updated_rows=0, error=last_error, contended=False)


SWEEP_MAX_PASSES = 20
UUID_MIN_SENTINEL: str = "00000000-0000-0000-0000-000000000000"


def process_table_data_batch(
    *,
    engine: Engine,
    schema: str,
    org_id: str,
    target: EncryptionTarget,
    encryption_service: EncryptionService,
    batch_size: int,
    dry_run: bool,
    config: BatchOperationConfig,
    inter_batch_sleep_seconds: float = 0.0,
) -> EncryptionResult:
    """Backfill a single table in two passes: keyset cursor, then sweep mop-up.

    Keyset walks `pk > :last_id` with a non-locking `window` CTE so the cursor
    advances past rows that FOR UPDATE SKIP LOCKED skipped. Sweep is a bounded
    number of predicate-only batches that retry the locked rows once the holder
    releases them.
    """
    if not table_exists(engine, schema, target.table):
        return EncryptionResult(table=target.table, total_rows=0, processed_count=0, error_count=0)

    pk_columns = get_pk_or_unique_columns(engine, schema, target.table)
    if not pk_columns:
        return EncryptionResult(
            table=target.table,
            total_rows=0,
            processed_count=0,
            error_count=0,
            error=f"No primary key found for {schema}.{target.table}",
        )

    if len(pk_columns) != 1:
        return EncryptionResult(
            table=target.table,
            total_rows=0,
            processed_count=0,
            error_count=0,
            error=f"Composite primary/unique keys are not supported for {schema}.{target.table}",
        )

    pk_col = pk_columns[0]

    pk_type_sql = text(
        "SELECT data_type FROM information_schema.columns "
        "WHERE table_schema = :schema AND table_name = :table AND column_name = :col"
    )
    with engine.connect() as conn:
        pk_type = conn.execute(pk_type_sql, {"schema": schema, "table": target.table, "col": pk_col}).scalar()
    if pk_type != "uuid":
        return EncryptionResult(
            table=target.table,
            total_rows=0,
            processed_count=0,
            error_count=0,
            error=(f"Keyset backfill requires uuid pk; {schema}.{target.table}.{pk_col} is {pk_type}"),
        )

    organization_key = encryption_service.derive_org_key(org_id)

    select_predicate = config.select_predicate

    count_sql = text(f'SELECT COUNT(*) FROM "{schema}"."{target.table}" AS target_table WHERE {select_predicate}')
    with engine.connect() as conn:
        total_rows = int(conn.execute(count_sql).scalar() or 0)

    if total_rows == 0:
        return EncryptionResult(table=target.table, total_rows=0, processed_count=0, error_count=0)

    if dry_run:
        return EncryptionResult(table=target.table, total_rows=total_rows, processed_count=0, error_count=0)

    # `win` is non-locking so max(pk) advances `last_id` past rows that
    # `batch` skipped via FOR UPDATE SKIP LOCKED. (Avoid `window` — reserved word.)
    keyset_sql = text(
        f"""WITH win AS MATERIALIZED (
            SELECT target_table."{pk_col}" AS pk
            FROM "{schema}"."{target.table}" AS target_table
            WHERE target_table."{pk_col}" > CAST(:last_id AS uuid) AND {select_predicate}
            ORDER BY target_table."{pk_col}"
            LIMIT :batch_size
        ),
        batch AS (
            SELECT target_table."{pk_col}" AS pk
            FROM "{schema}"."{target.table}" AS target_table
            WHERE target_table."{pk_col}" IN (SELECT pk FROM win)
            FOR UPDATE SKIP LOCKED
        ),
        upd AS (
            UPDATE "{schema}"."{target.table}" AS target_table
            SET "{target.encrypted_column}" = {config.encrypted_column_set_expr},
                "isEncrypted" = {config.is_encrypted_set_expr}
            FROM batch
            WHERE target_table."{pk_col}" = batch.pk
            RETURNING 1
        )
        SELECT (SELECT count(*) FROM upd) AS updated_rows,
               (SELECT pk FROM win ORDER BY pk DESC LIMIT 1) AS max_id"""
    )

    sweep_sql = text(
        f"""WITH batch AS (
            SELECT target_table."{pk_col}" AS pk
            FROM "{schema}"."{target.table}" AS target_table
            WHERE {select_predicate}
            ORDER BY target_table."{pk_col}"
            LIMIT :batch_size
            FOR UPDATE SKIP LOCKED
        ),
        upd AS (
            UPDATE "{schema}"."{target.table}" AS target_table
            SET "{target.encrypted_column}" = {config.encrypted_column_set_expr},
                "isEncrypted" = {config.is_encrypted_set_expr}
            FROM batch
            WHERE target_table."{pk_col}" = batch.pk
            RETURNING 1
        )
        SELECT (SELECT count(*) FROM upd) AS updated_rows,
               NULL AS max_id"""
    )

    processed_count = 0
    error_count = 0
    first_error: str | None = None
    contended = False

    lock_name = f"tenant-encryption:{schema}:{target.table}:{config.progress_label}"

    def _run(sql: TextClause, params: dict) -> _BatchOutcome:
        return _run_one_batch(
            engine=engine,
            lock_name=lock_name,
            organization_key=organization_key,
            update_sql=sql,
            params=params,
            progress_label=config.progress_label,
            schema=schema,
            table=target.table,
        )

    last_id: str = UUID_MIN_SENTINEL
    while True:
        outcome = _run(keyset_sql, {"batch_size": batch_size, "last_id": last_id})

        if outcome.contended:
            contended = True
            logger.warning(
                "Skipping %s for %s.%s: another worker holds the advisory lock",
                config.progress_label,
                schema,
                target.table,
            )
            break

        if outcome.error is not None:
            first_error = str(outcome.error)
            remaining_rows = max(total_rows - processed_count, 0)
            logger.error(
                "Error %s batch for %s in %s: %s (processed=%s, remaining~=%s)",
                config.progress_label,
                target.table,
                schema,
                outcome.error,
                processed_count,
                remaining_rows,
            )
            error_count += 1
            break

        if outcome.last_id is None:
            break

        last_id = outcome.last_id
        processed_count += outcome.updated_rows

        logger.info(f"    Batch complete: {processed_count}/{total_rows} {config.progress_label}, {error_count} errors")

        if inter_batch_sleep_seconds > 0:
            time.sleep(inter_batch_sleep_seconds)

    sweep_last_updated = 0
    sweep_exhausted = False
    rows_remaining_flag = False
    if not contended and first_error is None:
        for _ in range(SWEEP_MAX_PASSES):
            outcome = _run(sweep_sql, {"batch_size": batch_size})
            if outcome.contended:
                contended = True
                break
            if outcome.error is not None:
                first_error = str(outcome.error)
                error_count += 1
                break
            if outcome.updated_rows == 0:
                sweep_last_updated = 0
                break
            sweep_last_updated = outcome.updated_rows
            processed_count += outcome.updated_rows
            if inter_batch_sleep_seconds > 0:
                time.sleep(inter_batch_sleep_seconds)
        else:
            sweep_exhausted = sweep_last_updated > 0

    if sweep_exhausted:
        logger.error(
            "Sweep for %s.%s exhausted %s passes with rows still being updated; "
            "unencrypted rows likely remain — rerun the job",
            schema,
            target.table,
            SWEEP_MAX_PASSES,
        )
        if first_error is None:
            first_error = "sweep-exhausted"
            error_count += 1

    if not contended and first_error is None:
        with engine.connect() as conn:
            remaining = conn.execute(
                text(f'SELECT 1 FROM "{schema}"."{target.table}" AS target_table WHERE {select_predicate} LIMIT 1')
            ).scalar()
        if remaining is not None:
            logger.error(
                "%s.%s still has rows matching the backfill predicate after the "
                "job finished — rows held by long-running locks or inserted "
                "mid-run; rerun the job",
                schema,
                target.table,
            )
            rows_remaining_flag = True
            first_error = "rows-remaining"
            error_count += 1

    if contended:
        return EncryptionResult(
            table=target.table,
            total_rows=total_rows,
            processed_count=processed_count,
            error_count=0,
            error="locked-by-other-worker",
        )

    return EncryptionResult(
        table=target.table,
        total_rows=total_rows,
        processed_count=processed_count,
        error_count=error_count,
        error=first_error,
        sweep_exhausted=sweep_exhausted,
        rows_remaining=rows_remaining_flag,
    )


def _backfill_index_predicate(target: EncryptionTarget) -> str:
    """Partial-index WHERE clause mirroring build_encrypt_config's row selection."""
    if target.row_encrypt_predicate is None:
        return '"isEncrypted" = false'
    return f'"{target.encrypted_column}" IS NULL'


INDEX_VALIDITY_SQL = text(
    """
    SELECT x.indisvalid
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_namespace n ON n.oid = i.relnamespace
    WHERE n.nspname = :schema AND i.relname = :index_name
    """
)


def _ensure_backfill_index(engine: Engine, schema: str, target: EncryptionTarget) -> bool | None:
    """Create the backfill queue index with CREATE INDEX CONCURRENTLY.

    Returns True if the index is valid, False if missing/invalid (job keeps
    going with a keyset-only scan), or None when no index was attempted.
    """
    if not target.backfill_index_name or not table_exists(engine, schema, target.table):
        return None

    pk_columns = get_pk_or_unique_columns(engine, schema, target.table)
    if not pk_columns or len(pk_columns) != 1:
        return None
    pk_col = pk_columns[0]

    index_name = target.backfill_index_name
    predicate = _backfill_index_predicate(target)
    try:
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            drop_index_if_invalid(conn, schema, index_name)
            conn.execute(
                text(
                    f'CREATE INDEX CONCURRENTLY IF NOT EXISTS "{index_name}" '
                    f'ON "{schema}"."{target.table}" ("{pk_col}") WHERE {predicate}'
                )
            )
            indisvalid = conn.execute(INDEX_VALIDITY_SQL, {"schema": schema, "index_name": index_name}).scalar()
    except Exception as exc:  # noqa: BLE001 - the index is an optimization, never fatal
        logger.error(
            "Could not ensure backfill index %s.%s: %s — backfill will fall back to keyset-only scan",
            schema,
            index_name,
            exc,
        )
        return False

    if indisvalid is None:
        logger.error(
            "Backfill index %s.%s missing after CREATE INDEX CONCURRENTLY — keyset-only scan",
            schema,
            index_name,
        )
        return False
    if not indisvalid:
        logger.error(
            "Backfill index %s.%s is INVALID (indisvalid=false) — keyset-only scan",
            schema,
            index_name,
        )
        return False
    return True


def encrypt_table_data(
    *,
    engine: Engine,
    schema: str,
    org_id: str,
    target: EncryptionTarget,
    encryption_service: EncryptionService,
    batch_size: int,
    dry_run: bool,
    inter_batch_sleep_seconds: float = 0.0,
) -> EncryptionResult:
    """Backfill the encrypted column for rows where it is still NULL."""
    index_valid: bool | None = None
    if not dry_run:
        index_valid = _ensure_backfill_index(engine, schema, target)
        if index_valid is False:
            return EncryptionResult(
                table=target.table,
                total_rows=0,
                processed_count=0,
                error_count=1,
                error=f"backfill index {target.backfill_index_name} is missing or invalid for {schema}.{target.table}",
                backfill_index_valid=False,
            )
    result = process_table_data_batch(
        engine=engine,
        schema=schema,
        org_id=org_id,
        target=target,
        encryption_service=encryption_service,
        batch_size=batch_size,
        dry_run=dry_run,
        config=build_encrypt_config(target, schema),
        inter_batch_sleep_seconds=inter_batch_sleep_seconds,
    )
    result.backfill_index_valid = index_valid
    return result


def encrypt_org_data(
    *,
    engine: Engine,
    org_id: str,
    schema: str,
    encryption_service: EncryptionService,
    batch_size: int = 100,
    dry_run: bool = True,
    inter_batch_sleep_seconds: float = 0.0,
) -> dict[str, EncryptionResult]:
    """Backfill the encrypted columns across a tenant schema."""
    results: dict[str, EncryptionResult] = {}

    for target in ENCRYPTION_TARGETS:
        try:
            result = encrypt_table_data(
                engine=engine,
                schema=schema,
                org_id=org_id,
                target=target,
                encryption_service=encryption_service,
                batch_size=batch_size,
                dry_run=dry_run,
                inter_batch_sleep_seconds=inter_batch_sleep_seconds,
            )
            results[target.table] = result
        except Exception as e:
            logger.error("Error processing %s in %s: %s", target.table, schema, e)
            results[target.table] = EncryptionResult(
                table=target.table,
                total_rows=0,
                processed_count=0,
                error_count=1,
                error=str(e),
            )

    return results


def decrypt_table_data(
    *,
    engine: Engine,
    schema: str,
    org_id: str,
    target: EncryptionTarget,
    encryption_service: EncryptionService,
    batch_size: int,
    dry_run: bool,
    inter_batch_sleep_seconds: float = 0.0,
) -> EncryptionResult:
    """Roll back encryption for a single table by NULLing the encrypted column."""
    return process_table_data_batch(
        engine=engine,
        schema=schema,
        org_id=org_id,
        target=target,
        encryption_service=encryption_service,
        batch_size=batch_size,
        dry_run=dry_run,
        config=build_decrypt_config(target),
        inter_batch_sleep_seconds=inter_batch_sleep_seconds,
    )


def decrypt_org_data(
    *,
    engine: Engine,
    org_id: str,
    schema: str,
    encryption_service: EncryptionService,
    batch_size: int = 100,
    dry_run: bool = True,
    inter_batch_sleep_seconds: float = 0.0,
) -> dict[str, EncryptionResult]:
    """Roll back encryption across a tenant schema by NULLing the encrypted columns."""
    results: dict[str, EncryptionResult] = {}

    for target in ENCRYPTION_TARGETS:
        try:
            result = decrypt_table_data(
                engine=engine,
                schema=schema,
                org_id=org_id,
                target=target,
                encryption_service=encryption_service,
                batch_size=batch_size,
                dry_run=dry_run,
                inter_batch_sleep_seconds=inter_batch_sleep_seconds,
            )
            results[target.table] = result
        except Exception as e:
            logger.error("Error processing %s in %s: %s", target.table, schema, e)
            results[target.table] = EncryptionResult(
                table=target.table,
                total_rows=0,
                processed_count=0,
                error_count=1,
                error=str(e),
            )

    return results
