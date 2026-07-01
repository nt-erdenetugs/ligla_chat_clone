from __future__ import annotations

import logging
import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.common.errors import SchemaValidationError
from app.db.session import get_engine

logger = logging.getLogger(__name__)

ORG_SCHEMA_PATTERN = re.compile(r"^org_[a-f0-9]{32}$")


def validate_schema_name(schema_name: str) -> None:
    if not schema_name:
        raise SchemaValidationError("Schema name cannot be empty")

    if schema_name == "tenant_template":
        return

    if not ORG_SCHEMA_PATTERN.match(schema_name):
        raise SchemaValidationError(f"Schema name '{schema_name}' does not match expected pattern 'org_<32_hex_chars>'")


def schema_exists(schema_name: str, engine: Engine | None = None) -> bool:
    engine = engine or get_engine()

    validate_schema_name(schema_name)

    with engine.connect() as conn:
        result = conn.execute(
            text("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.schemata
                WHERE schema_name = :schema_name
            )
        """),
            {"schema_name": schema_name},
        )

        return bool(result.scalar())


def get_schema_table_count(schema_name: str, engine: Engine | None = None) -> int:
    engine = engine or get_engine()

    validate_schema_name(schema_name)

    with engine.connect() as conn:
        result = conn.execute(
            text("""
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = :schema_name
        """),
            {"schema_name": schema_name},
        )

        val = result.scalar()
        return int(val) if val is not None else 0


def drop_tenant_schema(schema_name: str, engine: Engine | None = None, force: bool = False) -> None:
    engine = engine or get_engine()

    validate_schema_name(schema_name)

    if not schema_exists(schema_name, engine):
        logger.warning(f"Schema '{schema_name}' does not exist")
        return

    if schema_name != "tenant_template" and not force:
        table_count = get_schema_table_count(schema_name, engine)
        if table_count > 0:
            raise SchemaValidationError(
                f"Cannot drop schema '{schema_name}' with {table_count} tables. Use force=True to override."
            )

    cascade_clause = " CASCADE" if force else ""
    with engine.begin() as conn:
        conn.execute(text(f'DROP SCHEMA "{schema_name}"{cascade_clause}'))

    logger.info(f"Dropped schema '{schema_name}'{' (CASCADE)' if force else ''}")


def get_schema_info(schema_name: str, engine: Engine | None = None) -> dict[str, Any]:
    engine = engine or get_engine()

    validate_schema_name(schema_name)

    info = {"name": schema_name, "exists": schema_exists(schema_name, engine), "table_count": 0, "tables": []}

    if info["exists"]:
        info["table_count"] = get_schema_table_count(schema_name, engine)

        with engine.connect() as conn:
            result = conn.execute(
                text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = :schema_name
                ORDER BY table_name
            """),
                {"schema_name": schema_name},
            )

            info["tables"] = [row[0] for row in result]

    return info
