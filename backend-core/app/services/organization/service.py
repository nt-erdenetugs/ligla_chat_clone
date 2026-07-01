from __future__ import annotations

import logging
import threading
from argparse import Namespace

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text

from alembic import command
from app.common.utils import uuid_to_schema_name
from app.config.settings import ALEMBIC_INI_PATH
from app.db.schema_manager import get_schema_info, validate_schema_name
from app.db.session import get_engine

logger = logging.getLogger(__name__)

_alembic_lock = threading.Lock()


class SchemaProvisioningError(Exception):
    pass


class SchemaProvisioningService:
    def provision(self, organization_id: str) -> dict[str, str | int | bool | None]:
        schema_name = uuid_to_schema_name(organization_id)
        validate_schema_name(schema_name)

        if self._is_schema_at_head(schema_name):
            schema_info = get_schema_info(schema_name)
            return {
                "success": True,
                "tableCount": int(schema_info["table_count"]),
                "alreadyExisted": True,
            }

        self._run_upgrade(schema_name)

        schema_info = get_schema_info(schema_name)
        if int(schema_info["table_count"]) <= 1:
            raise SchemaProvisioningError(f"Schema provisioning finished but schema '{schema_name}' has no tables")

        return {
            "success": True,
            "tableCount": int(schema_info["table_count"]),
            "alreadyExisted": False,
        }

    def _run_upgrade(self, schema_name: str) -> None:
        config = Config(str(ALEMBIC_INI_PATH))
        config.attributes["tenant_schema"] = schema_name
        config.attributes["skip_public_migration"] = True

        existing_x: list[str] = []
        if getattr(config, "cmd_opts", None) is not None:
            existing_x = list(getattr(config.cmd_opts, "x", []) or [])

        x_args = [
            arg for arg in existing_x if not arg.startswith("tenant=") and not arg.startswith("skip_public_migration=")
        ]
        x_args.extend([f"tenant={schema_name}", "skip_public_migration=true"])
        config.cmd_opts = Namespace(x=x_args, tag=None)

        acquired = _alembic_lock.acquire(timeout=30)
        if not acquired:
            raise SchemaProvisioningError("Another schema provisioning is in progress. Please retry shortly")

        try:
            command.upgrade(config, "head")
        except SchemaProvisioningError:
            raise
        except Exception as exc:  # pragma: no cover - wrapper around alembic internals
            logger.exception(
                "Alembic upgrade failed during schema provisioning",
                extra={"schema_name": schema_name},
            )
            raise SchemaProvisioningError(f"Failed to run alembic upgrade for schema '{schema_name}'") from exc
        finally:
            _alembic_lock.release()

    def _get_schema_revision(self, schema_name: str) -> str | None:
        validate_schema_name(schema_name)
        engine = get_engine()
        with engine.connect() as connection:
            try:
                result = connection.execute(text(f'SELECT version_num FROM "{schema_name}".alembic_version')).fetchone()
            except Exception as exc:
                logger.warning("Failed to read alembic revision for schema %s: %s", schema_name, exc)
                return None

        return result[0] if result else None

    def _is_schema_at_head(self, schema_name: str) -> bool:
        current_revision = self._get_schema_revision(schema_name)
        if current_revision is None:
            return False

        config = Config(str(ALEMBIC_INI_PATH))
        head_revision = ScriptDirectory.from_config(config).get_current_head()
        return current_revision == head_revision
