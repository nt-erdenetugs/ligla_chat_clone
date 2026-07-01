#!/usr/bin/env python3

from __future__ import annotations

import argparse
import logging
import sys

from app.db.session import get_engine_for_parallel_operations
from app.db.tenant_migration_config import TENANT_TABLES

from jobs.tenant_manager.manager import TenantManager
from jobs.tenant_manager.operations.table_order_validator import print_fk_dependency_graph, validate_and_raise
from jobs.tenant_manager.utils import ensure_environment

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate data from source schema to tenant schemas",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--source",
        type=str,
        required=True,
        help="Source schema containing mixed org data (e.g., public_old)",
    )

    parser.add_argument(
        "--commit",
        action="store_true",
        help="Actually copy data (default: dry-run mode)",
    )

    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of parallel workers (default: 1; auto-clamped to the job DB pool, effective max 4)",
    )

    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Continue processing other organizations if one fails",
    )

    return parser.parse_args()


def main(args: argparse.Namespace | None = None) -> int:
    if args is None:
        args = parse_args()

    engine = get_engine_for_parallel_operations()
    try:
        ensure_environment(engine)

        # Validate table order before migration to fail fast
        logger.info("\n🔍 Validating TENANT_TABLES migration order...")
        try:
            validate_and_raise(engine, TENANT_TABLES, schema=args.source)
            logger.info("✅ Table order validation passed: All FK dependencies satisfied\n")
        except ValueError as e:
            logger.error("\n❌ Table order validation failed:\n%s\n", e)
            print_fk_dependency_graph(engine, TENANT_TABLES, schema=args.source)
            return 1

        manager = TenantManager(engine)

        try:
            results = manager.migrate_all_to_tenant_schemas(
                source_schema=args.source,
                dry_run=not args.commit,
                max_workers=args.workers,
                continue_on_error=args.continue_on_error,
            )
            has_errors = any("error" in org_results for org_results in results.values())

            return 1 if has_errors else 0

        except Exception as e:
            logger.error("Error: %s", e)
            return 1
    finally:
        # Release the pool so the job stops holding Cloud SQL connections.
        engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
