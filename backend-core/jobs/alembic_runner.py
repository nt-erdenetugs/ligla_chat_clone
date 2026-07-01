#!/usr/bin/env python
import datetime
import logging
import os
import sys
import traceback
from io import StringIO
from typing import Any, override

import google.auth
import psycopg2
from dotenv import load_dotenv
from google.cloud import secretmanager
from pydantic_settings import BaseSettings, SettingsConfigDict
from pythonjsonlogger.json import JsonFormatter

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.util import CommandError


def map_to_gcp_severity(level: str, message: str = "") -> str:
    normalized = level.lower()
    message = message.lower()

    level_map: dict[str, str] = {
        "silly": "DEBUG",
        "debug": "DEBUG",
        "verbose": "DEBUG",
        "info": "INFO",
        "warning": "WARNING",
        "warn": "WARNING",
        "error": "ERROR",
        "critical": "CRITICAL",
    }

    if "alert" in message:
        return "ALERT"
    if "emergency" in message:
        return "EMERGENCY"

    return level_map.get(normalized, "DEFAULT")


def format_timestamp(record: logging.LogRecord) -> str:
    return (
        datetime.datetime.fromtimestamp(record.created, datetime.UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


class CloudLoggingFormatter(JsonFormatter):
    @override
    def add_fields(self, log_record: dict[str, Any], record: logging.LogRecord, message_dict: dict[str, Any]) -> None:
        super().add_fields(log_record, record, message_dict)

        log_record["timestamp"] = format_timestamp(record)
        log_record["severity"] = map_to_gcp_severity(record.levelname, record.getMessage())
        log_record["context"] = record.name
        log_record["message"] = record.getMessage()


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

handler = logging.StreamHandler(sys.stdout)
formatter = CloudLoggingFormatter(fmt="%(timestamp)s %(severity)s %(context)s %(message)s")
handler.setFormatter(formatter)

logger.addHandler(handler)
logger.propagate = False


def _print_migration_error(title: str, error: Exception) -> None:
    separator = "=" * 60
    logger.error(
        "\n%s\n%s\n%s\nError Type: %s\nError Message: %s\n\nFull Traceback:\n%s%s",
        separator,
        title,
        separator,
        type(error).__name__,
        error,
        traceback.format_exc(),
        separator,
    )


def get_exception_info(exception: Exception) -> dict[str, str | int | None]:
    info: dict[str, str | int | None] = {
        "error_type": type(exception).__name__,
        "error_message": str(exception),
    }

    tb = traceback.extract_tb(exception.__traceback__)
    if tb:
        last_frame = tb[-1]
        info["error_file"] = os.path.basename(last_frame.filename)
        info["error_line"] = last_frame.lineno
        info["error_function"] = last_frame.name

    return info


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, env_file_encoding="utf-8")

    GCP_PROJECT_ID: str
    GCP_STORAGE_CHAT_DATA_BUCKET: str
    GCP_STORAGE_CHAT_PUBLIC_DATA_BUCKET: str
    CLOUD_SQL_CONNECTION_NAME: str

    DB_HOST: str
    DB_PORT: str
    DB_USER: str
    DB_PASS: str
    DB_NAME: str


def validate_environment():
    try:
        Settings()
        logger.info("Environment validation successful", extra={"step": "validate_environment"})
        return True
    except Exception as e:
        logger.error(
            "Environment validation failed",
            extra={
                "step": "validate_environment",
                **get_exception_info(e),
            },
        )
        return False


def validate_cloud_sql_connection():
    try:
        settings = Settings()
        cloud_sql_path = f"/cloudsql/{settings.CLOUD_SQL_CONNECTION_NAME}"

        logger.info("Checking Cloud SQL socket path", extra={"step": "validate_cloud_sql_connection"})

        if not os.path.exists(cloud_sql_path):
            logger.error(
                "Cloud SQL socket path does not exist",
                extra={
                    "step": "validate_cloud_sql_connection",
                    "troubleshooting_steps": [
                        "Verify Cloud SQL Proxy is running",
                        "Check --set-cloudsql-instances flag matches CLOUD_SQL_CONNECTION_NAME",
                        "Verify the service account has cloudsql.client permissions",
                    ],
                },
            )
            return False

        logger.info("Cloud SQL socket verified", extra={"step": "validate_cloud_sql_connection"})
        return True
    except Exception as e:
        logger.error(
            "Cloud SQL validation failed with exception",
            extra={"step": "validate_cloud_sql_connection", **get_exception_info(e)},
        )
        return False


def test_db_connection():
    try:
        cloud_sql_connection_name = os.environ.get("CLOUD_SQL_CONNECTION_NAME")
        db_name = os.environ.get("DB_NAME")
        db_user = os.environ.get("DB_USER")
        socket_path = f"/cloudsql/{cloud_sql_connection_name}"

        conn_string = f"dbname={db_name} user={db_user} password={os.environ.get('DB_PASS')} host={socket_path}"

        logger.info("Testing database connection", extra={"step": "test_db_connection"})

        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()

        cursor.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alembic_version');")
        alembic_exists = cursor.fetchone()

        current_migration = None
        if alembic_exists and alembic_exists[0]:
            cursor.execute("SELECT version_num FROM alembic_version;")
            version_row = cursor.fetchone()
            current_migration = version_row[0] if version_row else "no_version_recorded"

        cursor.close()
        conn.close()

        logger.info(
            "Database connection successful",
            extra={
                "step": "test_db_connection",
                "current_migration_version": current_migration if current_migration else "fresh_database",
                "has_alembic_table": alembic_exists[0] if alembic_exists else False,
            },
        )
        return True
    except psycopg2.OperationalError as e:
        logger.error(
            "Database connection failed - OperationalError",
            extra={
                "step": "test_db_connection",
                **get_exception_info(e),
                "troubleshooting_steps": [
                    "Verify Cloud SQL Proxy is running and properly configured",
                    "Check database credentials are correct",
                    "Confirm database exists",
                    "Check network connectivity to Cloud SQL",
                    "Verify service account permissions",
                ],
            },
        )
        return False
    except psycopg2.Error as e:
        logger.error(
            "Database error",
            extra={
                "step": "test_db_connection",
                **get_exception_info(e),
                "pg_error_code": e.pgcode if hasattr(e, "pgcode") else None,
            },
        )
        return False
    except Exception as e:
        logger.error(
            "Unexpected error during database connection test",
            extra={"step": "test_db_connection", **get_exception_info(e)},
        )
        return False


def load_env_from_secret_manager():
    try:
        client = secretmanager.SecretManagerServiceClient()
        _, project_id = google.auth.default()
        secret_id = "CHAT_ENV"
        version_id = "latest"

        logger.info("Loading environment variables from Secret Manager", extra={"step": "load_env_from_secret_manager"})

        name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
        response = client.access_secret_version(request={"name": name})

        payload = StringIO(response.payload.data.decode("UTF-8"))
        load_dotenv(stream=payload)

        logger.info(
            "Successfully loaded environment variables from Secret Manager",
            extra={"step": "load_env_from_secret_manager"},
        )
        return True
    except Exception as e:
        logger.error(
            "Failed to load from Secret Manager",
            extra={
                "step": "load_env_from_secret_manager",
                **get_exception_info(e),
                "troubleshooting_steps": [
                    "Verify service account has secretmanager.versions.access permission",
                    "Check that CHAT_ENV secret exists in Secret Manager",
                    "Confirm the secret has a 'latest' version",
                    "Verify GCP project ID is correct",
                ],
            },
        )
        return False


def run_migrations(direction: str = "up", revision: str = "head"):
    try:
        logger.info(
            "Migration process started",
            extra={"step": "run_migrations", "direction": direction, "target_revision": revision},
        )

        if not load_env_from_secret_manager():
            logger.warning("Falling back to local .env file")
            load_dotenv("/code/.env.stg")

        if not validate_environment():
            logger.error(
                "Migration aborted - environment validation failed",
                extra={"step": "run_migrations", "reason": "missing_environment_variables"},
            )
            return 1

        if not validate_cloud_sql_connection():
            logger.error(
                "Migration aborted - Cloud SQL connection validation failed",
                extra={"step": "run_migrations", "reason": "cloud_sql_socket_unavailable"},
            )
            return 1

        if not test_db_connection():
            logger.error(
                "Migration aborted - database connection test failed",
                extra={"step": "run_migrations", "reason": "database_connection_failed"},
            )
            return 1

        dir_path = os.path.dirname(os.path.realpath(__file__))
        alembic_ini_path = os.path.join(dir_path, "..", "alembic.ini")

        logger.info("Initializing Alembic configuration", extra={"step": "run_migrations"})

        alembic_cfg = Config(alembic_ini_path)

        try:
            script = ScriptDirectory.from_config(alembic_cfg)
            head_rev = script.get_current_head()
            logger.info(
                "Latest migration available",
                extra={"step": "run_migrations", "latest_migration_version": head_rev},
            )
        except Exception as e:
            logger.warning(
                "Could not determine latest migration version",
                extra={"step": "run_migrations", **get_exception_info(e)},
            )

        try:
            direction = direction.lower().strip()
            revision = revision.lower().strip()

            if direction == "up":
                logger.info(
                    "Executing migration upgrade",
                    extra={"step": "run_migrations", "action": "upgrade", "target_revision": revision},
                )
                command.upgrade(alembic_cfg, revision)
            elif direction == "down":
                logger.info(
                    "Executing migration downgrade",
                    extra={"step": "run_migrations", "action": "downgrade", "target_revision": revision},
                )
                command.downgrade(alembic_cfg, revision, tag=revision)
            else:
                logger.error(
                    "Invalid migration direction",
                    extra={"step": "run_migrations", "direction": direction, "valid_directions": ["up", "down"]},
                )
                return 1

            logger.info(
                "Database migrations completed successfully",
                extra={
                    "step": "run_migrations",
                    "direction": direction,
                    "target_revision": revision,
                    "status": "success",
                },
            )
            return 0
        except CommandError as e:
            _print_migration_error("ALEMBIC MIGRATION ERROR", e)
            logger.error(
                "Alembic command error during migration",
                extra={
                    "step": "run_migrations",
                    **get_exception_info(e),
                    "full_traceback": traceback.format_exc(),
                    "troubleshooting_steps": [
                        "Check migration scripts for syntax errors",
                        "Verify database schema is in expected state",
                        "Review alembic_version table for inconsistencies",
                        "Check for conflicting migrations",
                    ],
                },
            )
            return 1

    except Exception as e:
        _print_migration_error("MIGRATION PROCESS FAILED", e)
        logger.error(
            "Migration process failed with unexpected error",
            extra={
                "step": "run_migrations",
                **get_exception_info(e),
                "full_traceback": traceback.format_exc(),
            },
        )
        return 1


def run_tenant_downgrade_all(revision: str) -> int:
    """Downgrade all tenant schemas to a specific revision."""
    from argparse import Namespace

    from sqlalchemy import text

    try:
        if not load_env_from_secret_manager():
            logger.warning("Falling back to local .env file")
            load_dotenv("/code/.env.stg")

        if not validate_environment():
            logger.error(
                "Tenant downgrade aborted - environment validation failed",
                extra={"step": "run_tenant_downgrade_all", "reason": "missing_environment_variables"},
            )
            return 1

        if not validate_cloud_sql_connection():
            logger.error(
                "Tenant downgrade aborted - Cloud SQL connection validation failed",
                extra={"step": "run_tenant_downgrade_all", "reason": "cloud_sql_socket_unavailable"},
            )
            return 1

        if not test_db_connection():
            logger.error(
                "Tenant downgrade aborted - database connection failed",
                extra={"step": "run_tenant_downgrade_all", "reason": "database_connection_failed"},
            )
            return 1

        dir_path = os.path.dirname(os.path.realpath(__file__))
        alembic_ini_path = os.path.join(dir_path, "..", "alembic.ini")
        revision = revision.lower().strip()

        from app.db.session import get_engine

        engine = get_engine()

        with engine.connect() as conn:
            has_org_table = conn.execute(
                text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name = 'organization')"
                )
            ).scalar()

            if has_org_table:
                result = conn.execute(text("SELECT id FROM public.organization"))
                tenants = [f"org_{str(row[0]).replace('-', '').lower()}" for row in result]
            else:
                logger.warning("Organization table not found, using pg_namespace to discover tenant schemas")
                result = conn.execute(
                    text("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'org_%' ORDER BY nspname")
                )
                tenants = [row[0] for row in result]

        if not tenants:
            logger.warning("No tenant schemas found to downgrade")
            return 0

        if "tenant_template" not in tenants:
            tenants.append("tenant_template")

        logger.info(
            "Starting tenant schema downgrade",
            extra={"step": "run_tenant_downgrade_all", "tenant_count": len(tenants), "target_revision": revision},
        )

        downgraded = []
        for schema in tenants:
            logger.info(
                f"Downgrading tenant schema: {schema}",
                extra={"step": "run_tenant_downgrade_all", "schema": schema, "target_revision": revision},
            )
            try:
                cfg = Config(alembic_ini_path)
                cfg.attributes["tenant_schema"] = schema
                cfg.attributes["skip_public_migration"] = True
                cfg.cmd_opts = Namespace(
                    x=[f"tenant={schema}", "skip_public_migration=true", "force=true"],
                    tag=None,
                )
                command.downgrade(cfg, revision, tag=revision)
                downgraded.append(schema)
            except Exception as e:
                label = "TENANT DOWNGRADE ERROR" if isinstance(e, CommandError) else "UNEXPECTED TENANT DOWNGRADE ERROR"
                _print_migration_error(f"{label}: {schema}", e)
                logger.error(
                    f"Tenant downgrade failed: {schema}",
                    extra={
                        "step": "run_tenant_downgrade_all",
                        "schema": schema,
                        "target_revision": revision,
                        "downgraded_so_far": downgraded,
                        "remaining": [s for s in tenants if s not in downgraded and s != schema],
                        **get_exception_info(e),
                        "full_traceback": traceback.format_exc(),
                    },
                )
                return 1

        logger.info(
            "All tenant schemas downgraded successfully",
            extra={"step": "run_tenant_downgrade_all", "tenant_count": len(tenants), "target_revision": revision},
        )
        return 0

    except Exception as e:
        _print_migration_error("TENANT DOWNGRADE PROCESS FAILED", e)
        logger.error(
            "Tenant downgrade process failed with unexpected error",
            extra={
                "step": "run_tenant_downgrade_all",
                **get_exception_info(e),
                "full_traceback": traceback.format_exc(),
            },
        )
        return 1


if __name__ == "__main__":
    direction = os.getenv("MIGRATION_DIRECTION", "up")
    revision = os.getenv("MIGRATION_REVISION", "head")

    if len(sys.argv) > 1:
        direction = sys.argv[1]
    if len(sys.argv) > 2:
        revision = sys.argv[2]

    logger.info(
        "Migration script invoked",
        extra={"step": "main", "direction": direction, "revision": revision},
    )

    exit_code = run_migrations(direction, revision)

    logger.info(
        "Migration script exiting",
        extra={"step": "main", "exit_code": exit_code, "status": "success" if exit_code == 0 else "failed"},
    )

    sys.exit(exit_code)
