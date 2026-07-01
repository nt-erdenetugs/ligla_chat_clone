#!/usr/bin/env python3

from __future__ import annotations

import argparse
import logging
import sys
from typing import TypedDict

from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from app.db.session import get_engine

from jobs.tenant_manager.operations.introspection import list_tenant_schemas
from jobs.tenant_manager.utils import ensure_environment

logger = logging.getLogger(__name__)


class SchemaDifferences(TypedDict):
    missing_tables: list[str]
    missing_columns: dict[str, list[str]]
    missing_indexes: dict[str, list[str]]


def compare_schemas(template_schema: str, tenant_schema: str, engine: Engine) -> SchemaDifferences:
    differences: SchemaDifferences = {
        "missing_tables": [],
        "missing_columns": {},
        "missing_indexes": {},
    }

    inspector = inspect(engine)

    try:
        template_tables = set(inspector.get_table_names(schema=template_schema))
    except Exception:
        logger.warning("Warning: Could not inspect template schema '%s'", template_schema)
        return differences

    try:
        tenant_tables = set(inspector.get_table_names(schema=tenant_schema))
    except Exception:
        logger.warning("Warning: Could not inspect tenant schema '%s'", tenant_schema)
        return differences

    differences["missing_tables"] = list(template_tables - tenant_tables)

    common_tables = template_tables & tenant_tables
    for table in common_tables:
        try:
            template_cols = {col["name"]: col for col in inspector.get_columns(table, schema=template_schema)}
            tenant_cols = {col["name"]: col for col in inspector.get_columns(table, schema=tenant_schema)}

            missing_cols = set(template_cols.keys()) - set(tenant_cols.keys())
            if missing_cols:
                differences["missing_columns"][table] = list(missing_cols)
        except Exception as exc:
            logger.warning("Warning: Could not compare columns for %s.%s: %s", tenant_schema, table, exc)

    return differences


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync template schema to tenant schemas")
    parser.add_argument("--template", default="tenant_template", help="Template schema name")
    parser.add_argument("--tenant", help="Specific tenant schema to check (default: all)")
    parser.add_argument("--dry-run", action="store_true", help="Only report differences, don't apply")
    return parser.parse_args()


def main(args: argparse.Namespace | None = None) -> int:
    if args is None:
        args = parse_args()
    engine = get_engine()
    ensure_environment(engine)

    if args.tenant:
        tenants = [args.tenant]
    else:
        tenants = list_tenant_schemas(engine)
        if args.template in tenants:
            tenants.remove(args.template)

    if not tenants:
        logger.info("No tenant schemas found")
        return 0

    logger.info("Comparing template '%s' with %s tenant schema(s)...\n", args.template, len(tenants))

    all_match = True
    for tenant in tenants:
        logger.info("Checking %s...", tenant)
        differences = compare_schemas(args.template, tenant, engine)

        has_differences = (
            differences["missing_tables"] or differences["missing_columns"] or differences["missing_indexes"]
        )

        if has_differences:
            all_match = False
            if differences["missing_tables"]:
                logger.error("  ✖ Missing tables: %s", ", ".join(differences["missing_tables"]))
            if differences["missing_columns"]:
                for table, cols in differences["missing_columns"].items():
                    logger.error("  ✖ %s: Missing columns: %s", table, ", ".join(cols))
        else:
            logger.info("  ✓ %s matches template", tenant)
        logger.info("")

    if all_match:
        logger.info("All schemas match template!")
        return 0

    logger.error("Some schemas differ from template")
    if args.dry_run:
        logger.info("\nRun without --dry-run to apply changes (not yet implemented)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
