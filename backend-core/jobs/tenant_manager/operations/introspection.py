from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from app.common.errors import SchemaValidationError
from app.db.schema_manager import get_schema_table_count, schema_exists, validate_schema_name
from app.db.session import get_engine

logger = logging.getLogger(__name__)


def get_enum_columns(engine: Engine, schema: str, table: str) -> dict[str, str]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT c.column_name, t.typname
                FROM information_schema.columns c
                JOIN pg_type t ON c.udt_name = t.typname
                WHERE c.table_schema = :schema
                  AND c.table_name = :table
                  AND c.data_type = 'USER-DEFINED'
                  AND t.typtype = 'e'
            """
            ),
            {"schema": schema, "table": table},
        ).fetchall()
        return {row[0]: row[1] for row in rows}


def get_columns(engine: Engine, schema: str, table: str, exclude_cols: tuple[str, ...]) -> list[str]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = :schema AND table_name = :table
                ORDER BY ordinal_position
            """
            ),
            {"schema": schema, "table": table},
        ).fetchall()

    cols = [r[0] for r in rows]
    return [c for c in cols if c not in exclude_cols]


def get_column_types(engine: Engine, schema: str, table: str, columns: list[str]) -> dict[str, tuple[str, str]]:
    if not columns:
        return {}

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT column_name, data_type, udt_name
                FROM information_schema.columns
                WHERE table_schema = :schema
                  AND table_name = :table
                  AND column_name = ANY(:cols)
            """
            ),
            {"schema": schema, "table": table, "cols": columns},
        ).fetchall()

    return {r[0]: (r[1], r[2]) for r in rows}


def get_pk_or_unique_columns(engine: Engine, schema: str, table: str) -> list[str]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                WITH idx AS (
                    SELECT
                        tc.constraint_type,
                        kcu.column_name,
                        tc.constraint_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name
                     AND tc.table_schema = kcu.table_schema
                    WHERE tc.table_schema = :schema
                      AND tc.table_name = :table
                      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
                )
                SELECT constraint_type, column_name
                FROM idx
                ORDER BY CASE WHEN constraint_type = 'PRIMARY KEY' THEN 0 ELSE 1 END, column_name
            """
            ),
            {"schema": schema, "table": table},
        ).fetchall()

    if not rows:
        return []

    has_pk = any(r[0] == "PRIMARY KEY" for r in rows)
    constraint_type = "PRIMARY KEY" if has_pk else "UNIQUE"

    return [r[1] for r in rows if r[0] == constraint_type]


def get_exact_table_name(engine: Engine, schema: str, table: str) -> str | None:
    with engine.connect() as conn:
        res = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = :schema AND table_name ILIKE :table"
            ),
            {"schema": schema, "table": table},
        ).fetchone()
        return str(res[0]) if res else None


def table_exists(engine: Engine, schema: str, table: str) -> bool:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT 1 FROM information_schema.tables WHERE table_schema = :schema AND table_name = :table"),
            {"schema": schema, "table": table},
        ).fetchone()
    return row is not None


def drop_index_if_invalid(conn: Connection, schema: str, index_name: str) -> None:
    """Drop a leftover INVALID index from an interrupted CREATE INDEX CONCURRENTLY.

    CONCURRENTLY ... IF NOT EXISTS matches on name, so an invalid same-named index
    would otherwise block every retry. The caller must run on an AUTOCOMMIT
    connection — DROP INDEX CONCURRENTLY cannot run inside a transaction.
    """
    invalid = conn.execute(
        text(
            "SELECT 1 FROM pg_class c "
            "JOIN pg_namespace n ON n.oid = c.relnamespace "
            "JOIN pg_index i ON i.indexrelid = c.oid "
            "WHERE n.nspname = :schema AND c.relname = :index AND i.indisvalid = false"
        ),
        {"schema": schema, "index": index_name},
    ).scalar()
    if invalid:
        conn.execute(text(f'DROP INDEX CONCURRENTLY IF EXISTS "{schema}"."{index_name}"'))


def list_tenant_schemas(engine: Engine | None = None) -> list[str]:
    engine = engine or get_engine()

    with engine.connect() as conn:
        result = conn.execute(
            text("""
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name LIKE 'org_%' OR schema_name = 'tenant_template'
            ORDER BY schema_name
        """)
        )

        return [row[0] for row in result]


def validate_tenant_schema_structure(schema_name: str, engine: Engine | None = None) -> None:
    engine = engine or get_engine()

    validate_schema_name(schema_name)

    if not schema_exists(schema_name, engine):
        raise SchemaValidationError(f"Schema '{schema_name}' does not exist")

    table_count = get_schema_table_count(schema_name, engine)
    if table_count == 0:
        raise SchemaValidationError(f"Schema '{schema_name}' has no tables")

    logger.info(f"Schema '{schema_name}' validation passed (tables: {table_count})")
