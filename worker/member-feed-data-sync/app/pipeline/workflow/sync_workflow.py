import zlib
from datetime import datetime, timezone

from sqlalchemy import text

from app.core.logger import logger
from app.core.schemas import SyncSummary
from app.core.session import get_db_connection, get_tenant_db_connection
from app.core.tenant_utils import lookup_organization_schema, ensure_tenant_table_exists
from app.pipeline.data_processing.gcs_handler import (
    discover_pending_files,
    extract_org_name,
    get_gcs_uri,
    move_to_failed,
    move_to_processed,
    validate_file,
)
from app.pipeline.db_ops.cloudsql_imports import import_csv_to_tenant_table
from app.pipeline.db_ops.table_operations import create_staging_table_in_schema

MAX_ADVISORY_LOCK_ID = 2147483647


async def execute_daily_sync() -> SyncSummary:
    start_time = datetime.now(timezone.utc)
    logger.info("Starting daily member sync (schema-per-tenant)")

    pending_files = await discover_pending_files()
    if not pending_files:
        logger.info("No pending files found - sync completed")
        return _create_empty_summary(start_time)

    logger.info(
        f"Found files for {len(pending_files)} organizations: {list(pending_files.keys())}"
    )

    results = []
    for org_name, file_info in pending_files.items():
        try:
            success = await sync_organization(org_name, file_info)
            results.append((org_name, success))
        except Exception as e:
            logger.error(f"Failed to sync {org_name}: {e}")
            results.append((org_name, False))

    return _create_summary(start_time, results)


async def sync_single_organization(org_name: str) -> bool:
    logger.info(f"Starting single organization sync for {org_name}")

    try:
        pending_files = await discover_pending_files()

        if org_name not in pending_files:
            logger.warning(f"No pending files found for organization: {org_name}")
            return False

        file_info = pending_files[org_name]
        success = await sync_organization(org_name, file_info)

        if success:
            logger.info(f"Single organization sync completed successfully: {org_name}")
        else:
            logger.error(f"Single organization sync failed: {org_name}")

        return success

    except Exception as e:
        logger.error(f"Single organization sync failed for {org_name}: {e}")
        return False


async def sync_specific_file(file_path: str) -> dict:
    logger.info(f"Starting file-specific sync: {file_path}")

    try:
        org_name = extract_org_name(file_path)

        if not org_name:
            error_msg = (
                f"Could not extract organization name from file path: {file_path}"
            )
            logger.error(error_msg)
            return {"success": False, "error": error_msg, "file_path": file_path}

        file_info = {
            "org_name": org_name,
            "file_path": file_path,
            "discovered_at": datetime.now(timezone.utc),
        }

        success = await sync_organization(org_name, file_info)

        result = {
            "success": success,
            "organization": org_name,
            "file_path": file_path,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }

        if success:
            logger.info(f"File-specific sync completed successfully: {file_path}")
        else:
            logger.error(f"File-specific sync failed: {file_path}")
            result["error"] = "File processing failed"

        return result

    except Exception as e:
        error_msg = f"File-specific sync failed for {file_path}: {e}"
        logger.error(error_msg)
        return {
            "success": False,
            "error": error_msg,
            "file_path": file_path,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }


async def sync_organization(org_name: str, file_info: dict) -> bool:
    file_path = file_info["file_path"]
    log_prefix = f"[SYNC_WORKFLOW][org:{org_name}][file:{file_path}]"

    # Acquire advisory lock to prevent race conditions
    lock_id = zlib.crc32(org_name.encode()) % MAX_ADVISORY_LOCK_ID
    lock_acquired = False
    schema_name = None
    staging_table = None

    workflow_start_time = datetime.now(timezone.utc)

    try:
        # Step 1: Validate file and get organization schema
        logger.info(
            f"{log_prefix} Step 1/6: Validating file and looking up organization..."
        )
        await validate_file(file_path)
        gcs_uri = get_gcs_uri(file_path)

        # Look up organization's schema
        with get_db_connection() as connection:
            org_info = lookup_organization_schema(connection, org_name)

            if org_info is None:
                error_msg = f"Organization not found: {org_name}"
                logger.error(f"{log_prefix} {error_msg}")
                await move_to_failed(file_path, error_msg)
                return False

            org_id, schema_name = org_info
            logger.info(
                f"{log_prefix} Organization found: {org_name} -> schema: {schema_name}"
            )

            # Verify tenant table exists
            if not ensure_tenant_table_exists(
                connection, schema_name, "memberFeedData"
            ):
                error_msg = f"memberFeedData table not found in schema {schema_name}"
                logger.error(f"{log_prefix} {error_msg}")
                await move_to_failed(file_path, error_msg)
                return False

        # Step 2: Acquire advisory lock
        logger.info(
            f"{log_prefix} Step 2/6: Acquiring advisory lock (ID: {lock_id})..."
        )
        with get_db_connection() as lock_conn:
            result = lock_conn.execute(
                text("SELECT pg_try_advisory_lock(:lock_id)"), {"lock_id": lock_id}
            )
            lock_acquired = result.scalar()

            if not lock_acquired:
                logger.warning(
                    f"{log_prefix} Another sync operation is in progress, skipping"
                )
                return False

        logger.info(f"{log_prefix} Advisory lock acquired")

        try:
            # Step 3: Create staging table in tenant schema
            logger.info(
                f"{log_prefix} Step 3/6: Creating staging table in {schema_name}..."
            )
            with get_db_connection() as connection:
                staging_table = create_staging_table_in_schema(
                    connection, org_name, schema_name
                )
                logger.info(
                    f"{log_prefix} Staging table created: {schema_name}.{staging_table}"
                )

            # Step 4: Import CSV data to staging table
            logger.info(f"{log_prefix} Step 4/6: Importing data from CSV...")
            import_start_time = datetime.now(timezone.utc)

            record_count = await import_csv_to_tenant_table(
                gcs_uri=gcs_uri,
                staging_table=staging_table,
                org_name=org_name,
                schema_name=schema_name,
            )

            import_duration = (
                datetime.now(timezone.utc) - import_start_time
            ).total_seconds()
            logger.info(
                f"{log_prefix} CSV import successful: {record_count:,} records in {import_duration:.2f}s"
            )

            # Step 5: Swap data from staging to main table
            logger.info(f"{log_prefix} Step 5/6: Swapping data to main table...")
            swap_start_time = datetime.now(timezone.utc)

            with get_tenant_db_connection(schema_name) as tenant_conn:
                # Delete all existing data (full replace since data is isolated by schema)
                delete_result = tenant_conn.execute(
                    text('DELETE FROM "memberFeedData"')
                )
                deleted_count = delete_result.rowcount
                logger.info(f"{log_prefix} Deleted {deleted_count:,} existing records")

                # Insert data from staging table
                insert_sql = f"""
                    INSERT INTO "memberFeedData" (
                        id, "clientUserId", "lineUserId",
                        category1, category2, category3, category4, category5,
                        category6, category7, category8, category9, category10,
                        category11, category12, category13, category14, category15,
                        category16, category17, category18, category19, category20,
                        category21, category22, category23, category24, category25,
                        number1, number2, number3, number4, number5,
                        number6, number7, number8, number9, number10,
                        number11, number12, number13, number14, number15,
                        datetime1, datetime2, datetime3, datetime4, datetime5,
                        datetime6, datetime7, datetime8, datetime9, datetime10,
                        datetime11, datetime12, datetime13, datetime14, datetime15,
                        "importedAt", "createdAt", "updatedAt", "syncedAt"
                    )
                    SELECT
                        id, "clientUserId", "lineUserId",
                        category1, category2, category3, category4, category5,
                        category6, category7, category8, category9, category10,
                        category11, category12, category13, category14, category15,
                        category16, category17, category18, category19, category20,
                        category21, category22, category23, category24, category25,
                        number1, number2, number3, number4, number5,
                        number6, number7, number8, number9, number10,
                        number11, number12, number13, number14, number15,
                        datetime1, datetime2, datetime3, datetime4, datetime5,
                        datetime6, datetime7, datetime8, datetime9, datetime10,
                        datetime11, datetime12, datetime13, datetime14, datetime15,
                        "importedAt", "createdAt", "updatedAt", "syncedAt"
                    FROM "{staging_table}"
                """

                insert_result = tenant_conn.execute(text(insert_sql))
                inserted_count = insert_result.rowcount

                # Drop staging table
                tenant_conn.execute(
                    text(f'DROP TABLE IF EXISTS "{staging_table}" CASCADE')
                )
                staging_table = None  # Mark as cleaned up

            swap_duration = (
                datetime.now(timezone.utc) - swap_start_time
            ).total_seconds()
            logger.info(
                f"{log_prefix} Data swap completed: {inserted_count:,} records in {swap_duration:.2f}s"
            )

            # Step 6: Verify and finalize
            logger.info(f"{log_prefix} Step 6/6: Verifying and finalizing...")

            with get_tenant_db_connection(schema_name) as verify_conn:
                verified_count = verify_imported_data(verify_conn, org_name)

                if verified_count != inserted_count:
                    logger.warning(
                        f"{log_prefix} Count mismatch: inserted {inserted_count}, verified {verified_count}"
                    )
                else:
                    logger.info(
                        f"{log_prefix} Data verified: {verified_count:,} records"
                    )

            # Move file to processed
            processed_path = await move_to_processed(file_path)
            logger.info(f"{log_prefix} File moved to processed: {processed_path}")

            total_duration = (
                datetime.now(timezone.utc) - workflow_start_time
            ).total_seconds()
            logger.info(
                f"{log_prefix} SUCCESS: Sync completed in {total_duration:.2f}s. "
                f"Total records synced: {verified_count:,}"
            )
            logger.info(
                f"SYNC_COMPLETE - Organization: {org_name}, Records: {verified_count:,}, "
                f"Duration: {total_duration:.2f}s, Status: SUCCESS"
            )
            return True

        except Exception as e:
            logger.error(f"{log_prefix} Sync failed: {e}")
            total_duration = (
                datetime.now(timezone.utc) - workflow_start_time
            ).total_seconds()
            logger.error(
                f"SYNC_FAILED - Organization: {org_name}, Duration: {total_duration:.2f}s, "
                f"Status: FAILED, Error: {e}"
            )

            # Cleanup staging table if it exists
            if staging_table and schema_name:
                try:
                    with get_tenant_db_connection(schema_name) as cleanup_conn:
                        cleanup_conn.execute(
                            text(f'DROP TABLE IF EXISTS "{staging_table}" CASCADE')
                        )
                        logger.info(
                            f"{log_prefix} Cleaned up staging table: {staging_table}"
                        )
                except Exception as cleanup_error:
                    logger.warning(
                        f"{log_prefix} Failed to cleanup staging table: {cleanup_error}"
                    )

            await move_to_failed(file_path, str(e))
            return False

    except Exception as e:
        total_duration = (
            datetime.now(timezone.utc) - workflow_start_time
        ).total_seconds()
        logger.error(
            f"{log_prefix} FATAL: Unhandled exception after {total_duration:.2f}s: {e}"
        )
        logger.error(
            f"SYNC_FAILED - Organization: {org_name}, Duration: {total_duration:.2f}s, "
            f"Status: FATAL_ERROR, Error: {e}"
        )
        try:
            await move_to_failed(file_path, str(e))
        except Exception as move_error:
            logger.error(
                f"{log_prefix} Failed to move file to failed directory: {move_error}"
            )
        return False

    finally:
        # Release advisory lock if acquired
        if lock_acquired:
            try:
                with get_db_connection() as unlock_conn:
                    lock_check = unlock_conn.execute(
                        text(
                            "SELECT EXISTS (SELECT 1 FROM pg_locks "
                            "WHERE locktype = 'advisory' AND objid = :lock_id AND pid = pg_backend_pid())"
                        ),
                        {"lock_id": lock_id},
                    ).scalar()

                    if lock_check:
                        unlock_conn.execute(
                            text("SELECT pg_advisory_unlock(:lock_id)"),
                            {"lock_id": lock_id},
                        )
                        logger.info(
                            f"{log_prefix} Advisory lock released (ID: {lock_id})"
                        )
                    else:
                        logger.warning(
                            f"{log_prefix} Advisory lock was already released"
                        )
            except Exception as unlock_error:
                logger.error(
                    f"{log_prefix} Failed to release advisory lock: {unlock_error}"
                )


def verify_imported_data(connection, org_name: str) -> int:
    try:
        result = connection.execute(text('SELECT COUNT(*) FROM "memberFeedData"'))

        count = result.scalar()
        logger.info(f"Database verification: {count} records found for {org_name}")

        # Check for null client IDs
        result = connection.execute(
            text("""
                SELECT COUNT(*) FROM "memberFeedData"
                WHERE "clientUserId" IS NULL OR "clientUserId" = ''
            """)
        )

        null_client_ids = result.scalar()
        if null_client_ids > 0:
            logger.warning(
                f"Found {null_client_ids} records with null/empty clientUserId for {org_name}"
            )

        return count

    except Exception as e:
        logger.error(f"Data verification failed for {org_name}: {e}")
        return 0


def _create_empty_summary(start_time: datetime) -> SyncSummary:
    """Create empty sync summary"""
    end_time = datetime.now(timezone.utc)
    return SyncSummary(
        sync_date=start_time,
        total_organizations=0,
        successful_syncs=0,
        failed_syncs=0,
        total_records_synced=0,
        total_duration_seconds=(end_time - start_time).total_seconds(),
        organizations_processed=[],
        failed_organizations={},
    )


def _create_summary(start_time: datetime, results: list[tuple]) -> SyncSummary:
    """Create sync summary from results"""
    end_time = datetime.now(timezone.utc)

    successful_orgs = [org for org, success in results if success]
    failed_orgs = {org: "Sync failed" for org, success in results if not success}

    return SyncSummary(
        sync_date=start_time,
        total_organizations=len(results),
        successful_syncs=len(successful_orgs),
        failed_syncs=len(failed_orgs),
        total_records_synced=0,  # Would need to track this during import
        total_duration_seconds=(end_time - start_time).total_seconds(),
        organizations_processed=successful_orgs,
        failed_organizations=failed_orgs,
    )
