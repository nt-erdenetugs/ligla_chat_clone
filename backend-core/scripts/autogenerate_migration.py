#!/usr/bin/env python3
# ruff: noqa: E402, I001 — sys.path must be set before app/third-party imports
import argparse
import os
import re
import sys
import time
import uuid as uuid_mod
from pathlib import Path

# Ensure backend-core is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("ENV", "local")

from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent.parent / "secret" / ".env"
if env_path.exists():
    load_dotenv(env_path)

from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import CheckConstraint, ForeignKeyConstraint, MetaData, PrimaryKeyConstraint, UniqueConstraint, create_engine, text
from sqlalchemy.engine import Engine

from app.config.settings import settings
from app.db.base import Base  # noqa: F401 — imports all models
from app.db.base_class import SCHEMA_TOKEN_TENANT
from app.db.migration_constants import SHARED_TABLES, TENANT_TABLES

TENANT_TEMPLATE = "tenant_template"


def _create_clean_engine() -> Engine:
    """Create engine WITHOUT schema_translate_map for direct schema inspection."""
    if settings.ENV in ("prd", "stg"):
        raise RuntimeError("autogenerate_migration.py must only run against local database")

    from sqlalchemy.engine.url import URL

    url = URL.create(
        drivername="postgresql+psycopg2",
        username=settings.DB_USER,
        password=settings.DB_PASS,
        host=settings.DB_HOST,
        port=int(settings.DB_PORT),
        database=settings.DB_NAME,
    )
    return create_engine(url)


# Metadata Remapping


def _remap_metadata_to_tenant_template() -> MetaData:
    """Create a NEW MetaData with SCHEMA_TOKEN_TENANT -> 'tenant_template'.

    Uses to_metadata() to copy all tables with corrected schema names.
    """
    remapped = MetaData()

    for table in Base.metadata.sorted_tables:
        new_schema = TENANT_TEMPLATE if table.schema == SCHEMA_TOKEN_TENANT else table.schema
        table.to_metadata(remapped, schema=new_schema)

    return remapped


# Diff Detection


def _get_diff(engine: Engine, metadata: MetaData) -> list:
    """Run compare_metadata against public + tenant_template schemas only."""
    allowed_schemas = {"public", TENANT_TEMPLATE}

    known_tables = SHARED_TABLES | TENANT_TABLES

    def include_name(name, type_, parent_names):
        if type_ == "schema":
            return name in allowed_schemas
        if type_ == "table":
            return name in known_tables
        return True

    with engine.connect() as conn:
        mc = MigrationContext.configure(
            connection=conn,
            opts={
                "target_metadata": metadata,
                "include_schemas": True,
                "include_name": include_name,
                "compare_type": True,
            },
        )
        return list(compare_metadata(mc, metadata))


def _get_table_name_from_diff(diff_item) -> str | None:
    """Extract table name from a diff item for filtering."""
    if isinstance(diff_item, tuple):
        op_type = diff_item[0]
        if op_type in ("add_table", "remove_table"):
            return diff_item[1].name
        if op_type in ("add_column", "remove_column", "modify_type", "modify_nullable", "modify_default"):
            return diff_item[2]
        if op_type in ("add_index", "remove_index"):
            idx = diff_item[1]
            return idx.table.name if hasattr(idx, "table") and idx.table is not None else None
        if op_type in ("add_constraint", "remove_constraint", "add_fk", "remove_fk"):
            c = diff_item[1]
            return c.table.name if hasattr(c, "table") and c.table is not None else None
    if isinstance(diff_item, list) and diff_item:
        return _get_table_name_from_diff(diff_item[0])
    return None


def _classify_diff(diffs: list, table_filter: set[str] | None = None) -> tuple[list, list, list]:
    """Classify diff ops into public, tenant, and cross-schema groups."""
    public_ops = []
    tenant_ops = []
    cross_schema_ops = []

    for diff_item in diffs:
        if table_filter:
            table_name = _get_table_name_from_diff(diff_item)
            if table_name and table_name not in table_filter:
                continue

        classified = _classify_single_diff(diff_item)
        if classified == "public":
            public_ops.append(diff_item)
        elif classified == "tenant":
            tenant_ops.append(diff_item)
        elif classified == "cross_schema":
            cross_schema_ops.append(diff_item)

    return public_ops, tenant_ops, cross_schema_ops


def _classify_single_diff(diff_item) -> str | None:
    """Classify a single diff item."""
    if isinstance(diff_item, tuple):
        op_type = diff_item[0]

        if op_type in ("add_table", "remove_table"):
            table = diff_item[1]
            table_name = table.name
            table_schema = getattr(table, "schema", None)
            return _classify_by_table(table_name, table_schema)

        if op_type in ("add_column", "remove_column", "modify_type", "modify_nullable", "modify_default"):
            return _classify_by_table(diff_item[2], diff_item[1])

        if op_type in ("add_index", "remove_index"):
            index = diff_item[1]
            if index.table is not None:
                return _classify_by_table(index.table.name, getattr(index.table, "schema", None))
            return "tenant"

        if op_type in ("add_constraint", "remove_constraint"):
            constraint = diff_item[1]
            if hasattr(constraint, "table") and constraint.table is not None:
                table_name = constraint.table.name
                table_schema = getattr(constraint.table, "schema", None)
                # Check for cross-schema FK
                if hasattr(constraint, "elements"):
                    for elem in constraint.elements:
                        ref_table = elem.column.table if hasattr(elem, "column") and elem.column is not None else None
                        if ref_table is not None:
                            ref_schema = getattr(ref_table, "schema", None)
                            if ref_schema != table_schema:
                                return "cross_schema"
                return _classify_by_table(table_name, table_schema)
            return "tenant"

        if op_type in ("add_fk", "remove_fk"):
            fk = diff_item[1]
            source_schema = getattr(fk, "source_schema", None) or getattr(fk.parent, "schema", None) if hasattr(fk, "parent") else None
            ref_schema = getattr(fk, "referred_schema", None)
            if source_schema != ref_schema and source_schema is not None and ref_schema is not None:
                return "cross_schema"
            table_name = fk.parent.name if hasattr(fk, "parent") else None
            if table_name:
                return _classify_by_table(table_name, source_schema)
            return "tenant"

    # Nested list of diffs (e.g., from table changes)
    if isinstance(diff_item, list):
        for sub_item in diff_item:
            result = _classify_single_diff(sub_item)
            if result:
                return result

    return None


def _classify_by_table(table_name: str, schema: str | None) -> str:
    if table_name in SHARED_TABLES:
        return "public"
    if table_name in TENANT_TABLES:
        return "tenant"
    raise ValueError(
        f"Table '{table_name}' (schema={schema}) not in SHARED_TABLES or TENANT_TABLES. "
        f"Update app/db/migration_constants.py before generating migrations."
    )


# Rendering


def _render_diff_item(diff_item, schema_context: str) -> list[str]:
    """Render a single diff item to Python code lines."""
    lines = []
    if isinstance(diff_item, tuple):
        op_type = diff_item[0]

        if op_type == "add_table":
            lines.extend(_render_add_table(diff_item[1], schema_context))
        elif op_type == "remove_table":
            lines.extend(_render_remove_table(diff_item[1], schema_context))
        elif op_type == "add_column":
            lines.extend(_render_add_column(diff_item[1], diff_item[2], diff_item[3], schema_context))
        elif op_type == "remove_column":
            lines.extend(_render_remove_column(diff_item[1], diff_item[2], diff_item[3], schema_context))
        elif op_type in ("modify_type", "modify_nullable", "modify_default"):
            lines.extend(_render_alter_column(diff_item, schema_context))
        elif op_type == "add_index":
            lines.extend(_render_add_index(diff_item[1], schema_context))
        elif op_type == "remove_index":
            lines.extend(_render_remove_index(diff_item[1], schema_context))
        elif op_type in ("add_constraint", "add_fk"):
            lines.extend(_render_add_constraint(diff_item[1], schema_context))
        elif op_type in ("remove_constraint", "remove_fk"):
            lines.extend(_render_remove_constraint(diff_item[1], schema_context))
        else:
            lines.append(f"# TODO: Unhandled operation: {op_type}")

    elif isinstance(diff_item, list):
        for sub in diff_item:
            lines.extend(_render_diff_item(sub, schema_context))

    return lines


def _schema_arg(schema_context: str, *, inline: bool = True) -> str:
    if schema_context != "tenant":
        return ""
    return ", schema=schema" if inline else "schema=schema"


def _render_column_repr(col) -> str:
    """Render a SQLAlchemy column to its constructor repr."""
    parts = [f'"{col.name}"']

    col_type = col.type
    type_str = _render_type(col_type)
    parts.append(type_str)

    is_composite_pk = col.primary_key and hasattr(col, "table") and col.table is not None and len(col.table.primary_key.columns) > 1
    if col.primary_key and not is_composite_pk:
        parts.append("primary_key=True")
    if not col.nullable and not col.primary_key:
        parts.append("nullable=False")
    if col.server_default is not None:
        default_text = str(col.server_default.arg) if hasattr(col.server_default, "arg") else str(col.server_default)
        if "now()" in default_text.lower():
            parts.append('server_default=sa.text("now()")')
        else:
            parts.append(f"server_default=sa.text({default_text!r})")

    return f"sa.Column({', '.join(parts)})"


def _render_type(col_type) -> str:
    """Render a column type to string."""
    type_name = type(col_type).__name__
    module = type(col_type).__module__

    # PostgreSQL specific types
    if "postgresql" in module or "psycopg2" in module:
        if type_name == "UUID":
            return "postgresql.UUID(as_uuid=True)"
        if type_name == "JSONB":
            return "postgresql.JSONB(astext_type=sa.Text())"
        if type_name == "JSON":
            return "postgresql.JSON()"
        if type_name == "ENUM":
            enums = col_type.enums if hasattr(col_type, "enums") else []
            enum_str = ", ".join(f"'{e}'" for e in enums)
            name = col_type.name if hasattr(col_type, "name") else "unknown"
            schema_part = col_type.schema if hasattr(col_type, "schema") else None
            if schema_part == TENANT_TEMPLATE:
                return f"postgresql.ENUM({enum_str}, name='{name}', schema=schema, create_type=False)"
            elif schema_part:
                return f"postgresql.ENUM({enum_str}, name='{name}', schema='{schema_part}', create_type=False)"
            return f"postgresql.ENUM({enum_str}, name='{name}', create_type=False)"
        if type_name == "ARRAY":
            inner = _render_type(col_type.item_type) if hasattr(col_type, "item_type") else "sa.String()"
            return f"postgresql.ARRAY({inner})"

    # VARCHAR with length must be checked before generic type_map
    if type_name == "VARCHAR" and hasattr(col_type, "length") and col_type.length:
        return f"sa.String(length={col_type.length})"

    # Standard SQLAlchemy types
    type_map = {
        "String": "sa.String()",
        "VARCHAR": "sa.String()",
        "Text": "sa.Text()",
        "TEXT": "sa.Text()",
        "Integer": "sa.Integer()",
        "INTEGER": "sa.Integer()",
        "BigInteger": "sa.BigInteger()",
        "BIGINT": "sa.BigInteger()",
        "Boolean": "sa.Boolean()",
        "BOOLEAN": "sa.Boolean()",
        "Float": "sa.Float()",
        "FLOAT": "sa.Float()",
        "DateTime": "sa.DateTime(timezone=True)",
        "TIMESTAMP": "sa.DateTime(timezone=True)",
        "Date": "sa.Date()",
        "DATE": "sa.Date()",
        "Numeric": "sa.Numeric()",
        "NUMERIC": "sa.Numeric()",
    }

    if type_name in type_map:
        return type_map[type_name]

    return f"sa.{type_name}()"


def _col_names(constraint) -> str:
    if not hasattr(constraint, "columns"):
        return ""
    return ", ".join(f'"{c.name}"' for c in constraint.columns)


def _render_table_constraints(table, schema_context: str) -> list[str]:
    lines = []
    for constraint in table.constraints:
        if isinstance(constraint, PrimaryKeyConstraint):
            if constraint.name and len(constraint.columns) > 1:
                lines.append(f'        sa.PrimaryKeyConstraint({_col_names(constraint)}, name="{constraint.name}"),')
        elif isinstance(constraint, ForeignKeyConstraint):
            ref_cols = ", ".join(f'"{e.target_fullname}"' for e in constraint.elements)
            parts = [f"[{_col_names(constraint)}]", f"[{ref_cols}]"]
            if constraint.name:
                parts.append(f'name="{constraint.name}"')
            if constraint.ondelete:
                parts.append(f'ondelete="{constraint.ondelete}"')
            lines.append(f"        sa.ForeignKeyConstraint({', '.join(parts)}),")
        elif isinstance(constraint, UniqueConstraint):
            if constraint.name and constraint.columns:
                lines.append(f'        sa.UniqueConstraint({_col_names(constraint)}, name="{constraint.name}"),')
        elif isinstance(constraint, CheckConstraint):
            if constraint.name:
                sql_text = str(constraint.sqltext)
                lines.append(f"        sa.CheckConstraint({sql_text!r}, name=\"{constraint.name}\"),")
    return lines


def _render_add_table(table, schema_context: str) -> list[str]:
    """Render CREATE TABLE operation."""
    lines = []

    # Collect tenant-schema enums that need explicit creation
    if schema_context == "tenant":
        for col in table.columns:
            if hasattr(col.type, "enums") and hasattr(col.type, "name"):
                enum_schema = getattr(col.type, "schema", None)
                if enum_schema == TENANT_TEMPLATE:
                    enums_str = ", ".join(f'"{e}"' for e in col.type.enums)
                    lines.append(
                        f'    postgresql.ENUM({enums_str}, name="{col.type.name}", '
                        f"schema=schema, create_type=False).create(op.get_bind(), checkfirst=True)"
                    )

    cols_repr = []
    for col in table.columns:
        cols_repr.append(f"        {_render_column_repr(col)},")

    cols_repr.extend(_render_table_constraints(table, schema_context))

    lines.append('    op.create_table(')
    lines.append(f'        "{table.name}",')
    lines.extend(cols_repr)
    kw = _schema_arg(schema_context, inline=False)
    if kw:
        lines.append(f"        {kw},")
    lines.append("    )")
    # Remove empty lines
    lines = [line for line in lines if line.strip()]
    return lines


def _render_remove_table(table, schema_context: str) -> list[str]:
    schema_kwarg = _schema_arg(schema_context)
    lines = [f'    op.drop_table("{table.name}"{schema_kwarg})']

    if schema_context == "tenant":
        for col in table.columns:
            if hasattr(col.type, "enums") and hasattr(col.type, "name"):
                lines.append(
                    f'    postgresql.ENUM(name="{col.type.name}", schema=schema)'
                    f".drop(op.get_bind(), checkfirst=True)"
                )
    return lines


def _render_add_column(schema_name, table_name, column, schema_context: str) -> list[str]:
    schema_kwarg = _schema_arg(schema_context)
    col_repr = _render_column_repr(column)
    return [f'    op.add_column("{table_name}", {col_repr}{schema_kwarg})']


def _render_remove_column(schema_name, table_name, column, schema_context: str) -> list[str]:
    schema_kwarg = _schema_arg(schema_context)
    return [f'    op.drop_column("{table_name}", "{column.name}"{schema_kwarg})']


def _render_alter_column(diff_item, schema_context: str, *, reverse: bool = False) -> list[str]:
    if len(diff_item) < 4:
        return [f"    # TODO: alter_column diff with unexpected format: {diff_item[0] if diff_item else 'empty'}"]
    op_type = diff_item[0]
    table_name = diff_item[2]
    col_name = diff_item[3]
    info = diff_item[4] if len(diff_item) > 4 else {}

    parts = [f'    op.alter_column("{table_name}", "{col_name}"']

    if op_type == "modify_type" and isinstance(info, dict):
        existing = info.get("existing_type")
        new = info.get("type_")
        type_val, existing_val = (existing, new) if reverse else (new, existing)
        if type_val:
            parts.append(f"        type_={_render_type(type_val)},")
        if existing_val:
            parts.append(f"        existing_type={_render_type(existing_val)},")

    if op_type == "modify_nullable" and isinstance(info, dict):
        if reverse:
            nullable = info.get("existing_nullable", not info.get("nullable", True))
        else:
            nullable = info.get("nullable", True)
        parts.append(f"        nullable={nullable},")
        existing_type = info.get("existing_type")
        if existing_type:
            parts.append(f"        existing_type={_render_type(existing_type)},")

    if op_type == "modify_default" and isinstance(info, dict):
        if reverse:
            default = info.get("existing_server_default")
        else:
            default = info.get("server_default")
        if default is not None:
            parts.append(f"        server_default=sa.text({str(default)!r}),")
        else:
            parts.append("        server_default=None,")
        if not reverse:
            existing_default = info.get("existing_server_default")
            if existing_default is not None:
                parts.append(f"        existing_server_default=sa.text({str(existing_default)!r}),")

    kw = _schema_arg(schema_context, inline=False)
    if kw:
        parts.append(f"        {kw},")

    parts.append("    )")
    return parts



def _get_pg_index_extras(index) -> str:
    extras = []
    dialect_opts = getattr(index, "dialect_options", {}).get("postgresql", {})
    pg_where = dialect_opts.get("where")
    if pg_where is not None:
        pg_str = pg_where.text if hasattr(pg_where, "text") else str(pg_where)
        extras.append(f", postgresql_where=sa.text({pg_str!r})")
    pg_using = dialect_opts.get("using")
    if pg_using:
        extras.append(f", postgresql_using='{pg_using}'")
    return "".join(extras)


def _render_add_index(index, schema_context: str) -> list[str]:
    cols = _col_names(index)
    table_name = index.table.name if index.table is not None else "unknown"
    idx_name = index.name or f"ix_{table_name}"
    unique = ", unique=True" if index.unique else ""
    pg_extras = _get_pg_index_extras(index)
    schema_kwarg = _schema_arg(schema_context)
    return [f'    op.create_index("{idx_name}", "{table_name}", [{cols}]{unique}{pg_extras}{schema_kwarg})']


def _render_remove_index(index, schema_context: str) -> list[str]:
    table_name = index.table.name if index.table is not None else "unknown"
    idx_name = index.name or f"ix_{table_name}"
    schema_kwarg = _schema_arg(schema_context)
    return [f'    op.drop_index("{idx_name}", table_name="{table_name}"{schema_kwarg})']


def _constraint_meta(constraint, schema_context: str) -> tuple[str, str, str]:
    schema_kwarg = _schema_arg(schema_context)
    table_name = constraint.table.name if hasattr(constraint, "table") and constraint.table is not None else "unknown"
    name = getattr(constraint, "name", None) or "unnamed"
    return schema_kwarg, table_name, name


def _render_add_constraint(constraint, schema_context: str) -> list[str]:
    schema_kwarg, table_name, name = _constraint_meta(constraint, schema_context)

    if isinstance(constraint, ForeignKeyConstraint):
        ref_table_name = table_name
        ref_col_names = []
        for elem in constraint.elements:
            if hasattr(elem, "column") and elem.column is not None:
                ref_table_name = elem.column.table.name
                ref_col_names.append(f'"{elem.column.name}"')
        ref_cols = ", ".join(ref_col_names)
        return [
            f'    op.create_foreign_key("{name}", "{table_name}", '
            f'"{ref_table_name}", [{_col_names(constraint)}], [{ref_cols}]{schema_kwarg})'
        ]

    if isinstance(constraint, UniqueConstraint):
        return [f'    op.create_unique_constraint("{name}", "{table_name}", [{_col_names(constraint)}]{schema_kwarg})']

    if isinstance(constraint, PrimaryKeyConstraint):
        return [f'    op.create_primary_key("{name}", "{table_name}", [{_col_names(constraint)}]{schema_kwarg})']

    if isinstance(constraint, CheckConstraint):
        return [f'    op.create_check_constraint("{name}", "{table_name}", sa.text({str(constraint.sqltext)!r}){schema_kwarg})']

    return [f"    # TODO: Add constraint '{name}' on '{table_name}' (type: {type(constraint).__name__})"]


def _render_remove_constraint(constraint, schema_context: str) -> list[str]:
    schema_kwarg, table_name, name = _constraint_meta(constraint, schema_context)
    type_map = {
        ForeignKeyConstraint: "foreignkey",
        UniqueConstraint: "unique",
        PrimaryKeyConstraint: "primary",
        CheckConstraint: "check",
    }
    for cls, type_name in type_map.items():
        if isinstance(constraint, cls):
            return [f'    op.drop_constraint("{name}", "{table_name}", type_="{type_name}"{schema_kwarg})']

    return [f'    op.drop_constraint("{name}", "{table_name}"{schema_kwarg})']


def _render_cross_schema_fk(diff_item) -> list[str]:
    """Render cross-schema FK as raw SQL with idempotent DO block."""
    lines = []
    if isinstance(diff_item, tuple) and len(diff_item) > 1:
        constraint = diff_item[1]
        table_name = constraint.table.name if hasattr(constraint, "table") and constraint.table is not None else "unknown"
        name = getattr(constraint, "name", None) or f"fk_{table_name}_cross"

        cols = []
        ref_parts = []
        if hasattr(constraint, "elements"):
            for elem in constraint.elements:
                if hasattr(elem, "parent") and hasattr(elem.parent, "name"):
                    cols.append(elem.parent.name)
                if hasattr(elem, "column") and elem.column is not None:
                    ref_table = elem.column.table.name
                    ref_schema = getattr(elem.column.table, "schema", "public")
                    if ref_schema == TENANT_TEMPLATE:
                        ref_schema = "{schema}"
                    ref_parts.append((ref_schema, ref_table, elem.column.name))

        if cols and ref_parts:
            if len(cols) != len(ref_parts):
                lines.append(f"    # TODO: Cross-schema FK column count mismatch on {table_name}")
                return lines
            ref_schema = ref_parts[0][0]
            ref_table = ref_parts[0][1]
            if any((rp[0], rp[1]) != (ref_schema, ref_table) for rp in ref_parts[1:]):
                lines.append(f"    # TODO: Cross-schema FK on {table_name} references multiple tables (unsupported)")
                return lines
            col_str = '", "'.join(cols)
            ref_col_str = '", "'.join(rp[2] for rp in ref_parts)
            lines.append(f'    # Cross-schema FK: {table_name} -> {ref_schema}.{ref_table}')
            lines.append("    connection.execute(text(f'''")
            lines.append("        DO $$")
            lines.append("        BEGIN")
            lines.append("            IF NOT EXISTS (")
            lines.append("                SELECT 1 FROM information_schema.table_constraints")
            lines.append(f"                WHERE constraint_name = '{name}'")
            lines.append('                AND table_schema = \'{schema}\'')
            lines.append("            ) THEN")
            lines.append(f'                ALTER TABLE "{{schema}}"."{table_name}"')
            lines.append(f'                ADD CONSTRAINT "{name}"')
            lines.append(f'                FOREIGN KEY ("{col_str}")')
            lines.append(f'                REFERENCES "{ref_schema}"."{ref_table}" ("{ref_col_str}");')
            lines.append("            END IF;")
            lines.append("        END $$;")
            lines.append("    '''))")
        else:
            lines.append("    # TODO: Cross-schema FK detected but could not auto-render")
            lines.append(f"    # Constraint: {name} on {table_name}")
    return lines


def _render_cross_schema_fk_downgrade(diff_item) -> list[str]:
    """Render cross-schema FK drop as raw SQL."""
    lines = []
    if isinstance(diff_item, tuple) and len(diff_item) > 1:
        constraint = diff_item[1]
        table_name = constraint.table.name if hasattr(constraint, "table") and constraint.table is not None else "unknown"
        name = getattr(constraint, "name", None) or f"fk_{table_name}_cross"

        lines.append("    connection.execute(text(f'''")
        lines.append("        DO $$")
        lines.append("        BEGIN")
        lines.append("            IF EXISTS (")
        lines.append("                SELECT 1 FROM information_schema.table_constraints")
        lines.append(f"                WHERE constraint_name = '{name}'")
        lines.append('                AND table_schema = \'{schema}\'')
        lines.append("            ) THEN")
        lines.append(f'                ALTER TABLE "{{schema}}"."{table_name}"')
        lines.append(f'                DROP CONSTRAINT "{name}";')
        lines.append("            END IF;")
        lines.append("        END $$;")
        lines.append("    '''))")
    return lines


# Downgrade Rendering


def _render_downgrade_item(diff_item, schema_context: str) -> list[str]:
    """Render the reverse of a diff item for downgrade."""
    if isinstance(diff_item, tuple):
        op_type = diff_item[0]

        if op_type == "add_table":
            return _render_remove_table(diff_item[1], schema_context)
        if op_type == "remove_table":
            return _render_add_table(diff_item[1], schema_context)
        if op_type == "add_column":
            return _render_remove_column(diff_item[1], diff_item[2], diff_item[3], schema_context)
        if op_type == "remove_column":
            return _render_add_column(diff_item[1], diff_item[2], diff_item[3], schema_context)
        if op_type == "add_index":
            return _render_remove_index(diff_item[1], schema_context)
        if op_type == "remove_index":
            return _render_add_index(diff_item[1], schema_context)
        if op_type in ("add_constraint", "add_fk"):
            return _render_remove_constraint(diff_item[1], schema_context)
        if op_type in ("remove_constraint", "remove_fk"):
            return _render_add_constraint(diff_item[1], schema_context)
        if op_type in ("modify_type", "modify_nullable", "modify_default"):
            return _render_alter_column(diff_item, schema_context, reverse=True)

    if isinstance(diff_item, list):
        lines = []
        for sub in reversed(diff_item):
            lines.extend(_render_downgrade_item(sub, schema_context))
        return lines

    return []


# Migration File Generation


def _generate_migration_file(
    message: str,
    public_ops: list,
    tenant_ops: list,
    cross_schema_ops: list,
    alembic_cfg: Config,
) -> str | None:
    """Generate migration file with classified operations."""
    has_public = bool(public_ops)
    has_tenant = bool(tenant_ops)
    has_cross = bool(cross_schema_ops)

    if not has_public and not has_tenant and not has_cross:
        print("\nNo changes detected. No migration file generated.")
        return None

    # Build upgrade body
    upgrade_lines = []
    downgrade_lines = []

    if has_public:
        upgrade_lines.append('    # === PUBLIC SCHEMA ===')
        upgrade_lines.append('    if schema == "public":')
        for op_item in public_ops:
            rendered = _render_diff_item(op_item, "public")
            for line in rendered:
                upgrade_lines.append(f"    {line}")
        upgrade_lines.append("")

        downgrade_lines.append('    # === PUBLIC SCHEMA ===')
        downgrade_lines.append('    if schema == "public":')
        for op_item in reversed(public_ops):
            rendered = _render_downgrade_item(op_item, "public")
            for line in rendered:
                downgrade_lines.append(f"    {line}")
        downgrade_lines.append("")

    if has_tenant or has_cross:
        upgrade_lines.append('    # === TENANT SCHEMA ===')
        upgrade_lines.append('    if not schema.startswith("org_") and schema != "tenant_template":')
        upgrade_lines.append("        return")
        upgrade_lines.append("")

        if has_cross:
            upgrade_lines.append("    connection = op.get_bind()")
            upgrade_lines.append("")

        for op_item in tenant_ops:
            rendered = _render_diff_item(op_item, "tenant")
            upgrade_lines.extend(rendered)

        if has_cross:
            upgrade_lines.append("")
            upgrade_lines.append("    # === CROSS-SCHEMA FK ===")
            for op_item in cross_schema_ops:
                upgrade_lines.extend(_render_cross_schema_fk(op_item))

        # Downgrade for tenant
        downgrade_lines.append('    # === TENANT SCHEMA ===')
        downgrade_lines.append('    if not schema.startswith("org_") and schema != "tenant_template":')
        downgrade_lines.append("        return")
        downgrade_lines.append("")

        if has_cross:
            downgrade_lines.append("    connection = op.get_bind()")
            downgrade_lines.append("")

        if has_cross:
            downgrade_lines.append("    # === CROSS-SCHEMA FK (drop first) ===")
            for op_item in reversed(cross_schema_ops):
                downgrade_lines.extend(_render_cross_schema_fk_downgrade(op_item))
            downgrade_lines.append("")

        for op_item in reversed(tenant_ops):
            rendered = _render_downgrade_item(op_item, "tenant")
            downgrade_lines.extend(rendered)

    # Use alembic to create the revision file (skeleton)
    script = ScriptDirectory.from_config(alembic_cfg)
    head = script.get_current_head()

    rev_id = uuid_mod.uuid4().hex[:12]
    slug = re.sub(r"[^a-z0-9]+", "_", message.lower()).strip("_")[:40]
    filename = f"{rev_id}_{slug}.py"
    filepath = Path(script.dir) / "versions" / filename

    NEWLINE = "\n"
    imports = ['from alembic import op', 'import sqlalchemy as sa']

    # Check if postgresql types are used
    all_lines = upgrade_lines + downgrade_lines
    all_text = "\n".join(all_lines)
    if "postgresql." in all_text:
        imports.append("from sqlalchemy.dialects import postgresql")
    if has_cross:
        imports.append("from sqlalchemy import text")
    upgrade_body = "\n".join(upgrade_lines) if upgrade_lines else "    pass"
    downgrade_body = "\n".join(downgrade_lines) if downgrade_lines else "    pass"

    content = f'''"""{message}

Revision ID: {rev_id}
Revises: {head}
Create Date: {time.strftime("%Y-%m-%d %H:%M:%S")}

"""
{NEWLINE.join(imports)}

revision = '{rev_id}'
down_revision = {head!r}
branch_labels = None
depends_on = None


def upgrade():
    schema = op.get_context().version_table_schema or "public"

{upgrade_body}


def downgrade():
    schema = op.get_context().version_table_schema or "public"

{downgrade_body}
'''

    filepath.write_text(content)
    return str(filepath)


# Main


def _check_tenant_template_exists(engine: Engine) -> bool:
    with engine.connect() as conn:
        schema_exists = conn.execute(
            text("SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'tenant_template')")
        ).scalar()
        if not schema_exists:
            return False
        table_count = conn.execute(
            text("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'tenant_template'")
        ).scalar()
        if table_count == 0:
            print("WARNING: tenant_template schema exists but has no tables.")
            print("Run 'make migrate && make tenant-upgrade-all REV=head' to populate it.")
            return False
        return True


def main():
    parser = argparse.ArgumentParser(description="Auto-generate multi-tenant Alembic migration")
    parser.add_argument("-m", "--message", required=True, help="Migration message")
    parser.add_argument("--public-only", action="store_true", help="Only detect public schema changes")
    parser.add_argument("--tenant-only", action="store_true", help="Only detect tenant schema changes")
    parser.add_argument("--dry-run", action="store_true", help="Show diff without generating file")
    parser.add_argument("--table", nargs="+", help="Only include operations for specific table(s)")
    args = parser.parse_args()

    print(f"Autogenerate migration: {args.message}")
    print("=" * 60)

    # Clean engine without schema_translate_map (needed for direct schema inspection)
    engine = _create_clean_engine()
    try:
        _main_with_engine(engine, args)
    finally:
        engine.dispose()


def _main_with_engine(engine: Engine, args):
    alembic_cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))

    if not args.public_only and not _check_tenant_template_exists(engine):
        print("ERROR: tenant_template schema is missing or empty.")
        print("Run 'make migrate && make tenant-upgrade-all REV=head' to create and populate it.")
        sys.exit(1)

    print("Remapping model metadata (SCHEMA_TOKEN_TENANT -> tenant_template)...")
    metadata = _remap_metadata_to_tenant_template()

    print("Comparing models against database...")
    diffs = _get_diff(engine, metadata)

    if not diffs:
        print("\nNo changes detected between models and database.")
        return

    # Classify (with optional table filter)
    table_filter = set(args.table) if args.table else None
    public_ops, tenant_ops, cross_schema_ops = _classify_diff(diffs, table_filter)

    # Apply filters
    if args.public_only:
        tenant_ops = []
        cross_schema_ops = []
    if args.tenant_only:
        public_ops = []

    # Print summary
    print("\nDetected changes:")
    print(f"  Public schema ops:  {len(public_ops)}")
    print(f"  Tenant schema ops:  {len(tenant_ops)}")
    print(f"  Cross-schema ops:   {len(cross_schema_ops)}")

    if args.dry_run:
        print("\n--- DRY RUN: Upgrade operations ---")
        for op_item in public_ops:
            for line in _render_diff_item(op_item, "public"):
                print(f"  [PUBLIC] {line}")
        for op_item in tenant_ops:
            for line in _render_diff_item(op_item, "tenant"):
                print(f"  [TENANT] {line}")
        for op_item in cross_schema_ops:
            for line in _render_cross_schema_fk(op_item):
                print(f"  [CROSS]  {line}")
        return

    # Generate file
    filepath = _generate_migration_file(
        args.message, public_ops, tenant_ops, cross_schema_ops, alembic_cfg
    )

    if filepath:
        print(f"\nGenerated: {filepath}")
        print("\nNext steps:")
        print("  1. Review the generated migration file")
        print("  2. make migrate                        # Apply to public schema")
        print("  3. make tenant-upgrade-all REV=head    # Apply to all tenants")


if __name__ == "__main__":
    main()
