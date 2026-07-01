from __future__ import annotations

import threading
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import sqlalchemy
from sqlalchemy import text
from sqlalchemy.engine import Engine

from jobs.tenant_manager.operations.encryption import EncryptionResult
from jobs.tenant_manager.operations.introspection import list_tenant_schemas

logger = logging.getLogger(__name__)


def check_database_connection(engine: Engine) -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("✓ Database connectivity: OK")
        return True
    except Exception as exc:
        logger.error("✗ Database connectivity: FAILED (%s)", exc)
        return False


def _parse_version(version_str: str) -> tuple[int, ...]:
    return tuple(int(x) for x in version_str.split(".")[:3])


def check_sqlalchemy_version() -> bool:
    version = sqlalchemy.__version__
    if _parse_version(version) >= _parse_version("1.4.0"):
        logger.info("✓ SQLAlchemy version: %s (OK)", version)
        return True
    logger.error("✗ SQLAlchemy version: %s (Requires >= 1.4.0)", version)
    return False


def check_alembic_config() -> bool:
    if Path("alembic.ini").exists():
        logger.info("✓ Alembic configuration: FOUND")
        return True
    logger.error("✗ Alembic configuration: MISSING (alembic.ini)")
    return False


def check_database_permissions(engine: Engine) -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS _migration_test_permissions"))
            conn.execute(text("DROP SCHEMA _migration_test_permissions"))
        logger.info("✓ Database permissions: OK")
        return True
    except Exception as exc:
        logger.error("✗ Database permissions: FAILED (%s)", exc)
        return False


def validate_environment(engine: Engine) -> bool:
    checks = [
        check_database_connection(engine),
        check_sqlalchemy_version(),
        check_alembic_config(),
        check_database_permissions(engine),
    ]

    if all(checks):
        logger.info("\n✓ Environment validation passed")
        return True

    logger.error("\n✗ Environment validation failed")
    return False


def get_public_schema_version(engine: Engine) -> str | None:
    """Get the current migration version from the public schema's alembic_version table."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version_num FROM public.alembic_version")).fetchone()
            return result[0] if result else None
    except Exception:
        return None


def verify_tenant_schema_versions(engine: Engine) -> tuple[bool, list[tuple[str, str | None, str]]]:
    head_rev = get_public_schema_version(engine)
    if not head_rev:
        logger.error("ERROR: Could not determine head revision from public schema")
        return False, []

    logger.info("Head revision: %s", head_rev)
    logger.info("Checking tenant schemas...\n")

    tenants = list_tenant_schemas(engine)
    if not tenants:
        logger.info("No tenant schemas found")
        return True, []

    mismatches: list[tuple[str, str | None, str]] = []
    with engine.connect() as conn:
        for tenant in tenants:
            version = get_schema_version(conn, tenant)
            if version != head_rev:
                mismatches.append((tenant, version, head_rev))
                logger.error("  ✖ %s: %s (expected: %s)", tenant, version or "NO_VERSION", head_rev)
            else:
                logger.info("  ✓ %s: %s", tenant, version)

    if mismatches:
        logger.error("\nVerification failed: %d schemas not at head", len(mismatches))
        return False, mismatches

    logger.info("\nAll schemas are at head revision!")
    return True, []


def get_schema_version(connection: Any, schema: str) -> str | None:
    try:
        result = connection.execute(text('SELECT version_num FROM "' + schema + '".alembic_version')).fetchone()
        return result[0] if result else None
    except Exception:
        return None


# Thread-safe logging for parallel execution
_thread_lock = threading.Lock()


def log_with_timestamp(message: str, prefix: str = "") -> None:
    """Thread-safe logging with timestamp and optional prefix."""
    with _thread_lock:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if prefix:
            logger.info("[%s] %s %s", timestamp, prefix, message)
        else:
            logger.info("[%s] %s", timestamp, message)


def log_org_progress(org_name: str, message: str) -> None:
    """Thread-safe logging for organization-specific progress."""
    log_with_timestamp(message, f"[{org_name}]")


def calculate_performance_metrics(timings: dict[str, float]) -> dict[str, float]:
    """Calculate performance metrics from timing data."""
    if not timings:
        return {"total": 0.0, "average": 0.0, "min": 0.0, "max": 0.0, "speedup": 1.0}

    total_time = sum(timings.values())
    wall_time = max(timings.values())

    return {
        "total": total_time,
        "average": total_time / len(timings),
        "min": min(timings.values()),
        "max": max(timings.values()),
        "speedup": total_time / wall_time if wall_time > 0 else 1.0,
    }


def validate_worker_count(engine: Engine, requested_workers: int) -> int:
    """Validate and adjust worker count based on connection pool limits."""
    # Get current connection pool configuration
    pool_size = engine.pool.size()  # type: ignore
    max_overflow = engine.pool._max_overflow  # type: ignore  # noqa: SLF001
    max_connections = pool_size + max_overflow

    # Reserve 2 connections for other operations
    max_workers = max(1, min(requested_workers, max_connections - 2))

    if max_workers < requested_workers:
        logger.warning(
            "⚠️  Requested %d workers, but limited to %d due to connection pool (max: %d)",
            requested_workers,
            max_workers,
            max_connections,
        )

    return max_workers


def ensure_environment(engine: Engine) -> None:
    if not validate_environment(engine):
        raise SystemExit(1)


def has_operation_errors(results: dict[str, dict[str, EncryptionResult]]) -> bool:
    return any(any(not result.is_success for result in org_results.values()) for org_results in results.values())
