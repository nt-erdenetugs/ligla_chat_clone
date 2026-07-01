from collections.abc import Generator
from contextlib import contextmanager
from typing import Any, Callable

from sqlalchemy import text
from sqlalchemy.orm import Session

from logger.logger import ProcessingStatus, logger, DataProcessingError


@contextmanager
def advisory_lock(db: Session, org_name: str):
    """Advisory lock with proper connection cleanup"""
    lock_acquired = False
    try:
        _ = db.execute(
            text("SELECT pg_advisory_lock(hashtext(:org_name));"),
            {"org_name": org_name},
        )
        lock_acquired = True
        logger.info(f"Acquired advisory lock for organization: {org_name}")
        yield
    except Exception as e:
        logger.error(f"Error in advisory lock for {org_name}: {e}")
        raise
    finally:
        if lock_acquired:
            try:
                db.execute(
                    text("SELECT pg_advisory_unlock(hashtext(:org_name));"),
                    {"org_name": org_name},
                )
                logger.info(f"Released advisory lock for organization: {org_name}")
            except Exception as e:
                logger.error(f"Failed to release advisory lock for {org_name}: {e}")


@contextmanager
def log_operation(operation: str, items: int):
    logger.info(f"Starting {operation} for {items} items")
    try:
        yield
        logger.info(f"Completed {operation} for {items} items")
    except Exception as e:
        logger.error(f"Failed {operation}: {str(e)}")
        raise


@contextmanager
def safe_database_operation(
    operation_name: str,
    data: list[dict[str, Any]],
    status: ProcessingStatus,
    clean_fn: Callable[[list[dict[str, Any]]], list[dict[str, Any]]],
) -> Generator[list[dict[str, Any]], None, None]:
    """
    DRY context manager for database operations with consistent error handling.
    """
    operation_count = len(data)
    try:
        # Clean data before operation
        cleaned_data = clean_fn(data)
        yield cleaned_data
        status.update(operation_count)
        logger.info(
            f"Successfully completed {operation_name} for {operation_count} items"
        )
    except Exception as e:
        status.update(0, operation_count)
        error_msg = f"Failed {operation_name}: {str(e)}"
        logger.error(error_msg)

        raise DataProcessingError(error_msg)
