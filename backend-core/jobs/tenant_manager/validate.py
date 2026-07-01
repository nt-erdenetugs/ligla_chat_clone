#!/usr/bin/env python3

from __future__ import annotations

import argparse
import logging
import sys

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.db.cross_schema_fks import CROSS_SCHEMA_FKS, ForeignKeySpec
from app.db.schema_manager import schema_exists
from app.db.session import get_engine

from jobs.tenant_manager.manager import TenantManager
from jobs.tenant_manager.operations.introspection import list_tenant_schemas, validate_tenant_schema_structure
from jobs.tenant_manager.utils import ensure_environment, verify_tenant_schema_versions

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate tenant schema data against source data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--org",
        type=str,
        help="Organization name (validate single org only)",
    )

    parser.add_argument(
        "--source",
        type=str,
        default="public_old",
        help="Source schema for validation (default: public_old)",
    )

    parser.add_argument(
        "--deep",
        action="store_true",
        help="Perform deep validation with checksum comparison (slower but more thorough)",
    )

    parser.add_argument(
        "--template",
        action="store_true",
        help="Validate tenant template schema structure only",
    )

    parser.add_argument(
        "--cross-schema-fks",
        action="store_true",
        help="Validate cross-schema foreign keys across all tenant schemas",
    )

    return parser.parse_args()


def _check_fk_exists(connection: Connection, schema: str, fk_spec: ForeignKeySpec) -> bool:
    table_row = connection.execute(
        text("SELECT 1 FROM information_schema.tables WHERE table_schema = :schema AND table_name = :table"),
        {"schema": schema, "table": fk_spec.tenant_table},
    ).fetchone()

    if not table_row:
        return False

    constraint_name = fk_spec.constraint_name or f"fk_{fk_spec.tenant_table}_{fk_spec.tenant_column}"

    result = connection.execute(
        text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE constraint_schema = :schema AND LOWER(constraint_name) = LOWER(:name) "
            "AND constraint_type = 'FOREIGN KEY'"
        ),
        {"schema": schema, "name": constraint_name},
    ).fetchone()

    return result is not None


def _validate_template(engine) -> int:
    template = "tenant_template"

    if not schema_exists(template, engine):
        logger.error("Template schema '%s' does not exist. Please create it and run migrations.", template)
        return 1

    try:
        validate_tenant_schema_structure(template, engine)
        logger.info("Template schema '%s' is valid.", template)
    except Exception as exc:
        logger.error("Template schema '%s' validation failed: %s", template, exc)
        return 1

    return 0


def _validate_cross_schema_fks(engine) -> int:
    tenants = list_tenant_schemas(engine)
    if not tenants:
        logger.info("No tenant schemas found")
        return 0

    logger.info("Validating cross-schema FKs across %s tenant schemas...\n", len(tenants))

    failures: list[tuple[str, str, ForeignKeySpec]] = []
    for tenant in tenants:
        logger.info("Checking %s...", tenant)
        with engine.connect() as conn:
            for fk in CROSS_SCHEMA_FKS:
                if not _check_fk_exists(conn, tenant, fk):
                    constraint_name = fk.constraint_name or f"fk_{fk.tenant_table}_{fk.tenant_column}"
                    failures.append((tenant, constraint_name, fk))
                    logger.error("  ✖ %s.%s: Missing FK '%s'", tenant, fk.tenant_table, constraint_name)
                else:
                    logger.info("  ✓ %s.%s: FK exists", tenant, fk.tenant_table)
        logger.info("")

    if failures:
        logger.error("Validation failed: %d missing FKs found", len(failures))
        for tenant, constraint_name, fk in failures:
            logger.error("  - %s.%s: Missing '%s'", tenant, fk.tenant_table, constraint_name)
        return 1

    logger.info("All cross-schema FKs validated successfully!")
    return 0


def main(args: argparse.Namespace | None = None) -> int:
    if args is None:
        args = parse_args()

    engine = get_engine()

    ensure_environment(engine)

    if getattr(args, "template", False):
        return _validate_template(engine)

    if getattr(args, "cross_schema_fks", False):
        return _validate_cross_schema_fks(engine)

    ok, _ = verify_tenant_schema_versions(engine)
    if not ok:
        return 1

    manager = TenantManager(engine)

    try:
        if args.org:
            all_valid, _ = manager.validate_single_org(args.org, deep=args.deep)
            return 0 if all_valid else 2
        else:
            all_valid, _ = manager.validate_all(deep=args.deep)
            return 0 if all_valid else 2

    except Exception as e:
        logger.error("Error: %s", e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
