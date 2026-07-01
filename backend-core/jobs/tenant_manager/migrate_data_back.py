#!/usr/bin/env python3

from __future__ import annotations

import argparse
import logging
import sys

from app.db.session import get_engine_for_parallel_operations

from jobs.tenant_manager.manager import TenantManager
from jobs.tenant_manager.utils import ensure_environment

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rollback: Migrate data from tenant schemas back to public schema",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--target",
        type=str,
        default="public_old",
        help="Target schema for rollback (default: public_old)",
    )

    parser.add_argument(
        "--commit",
        action="store_true",
        help="Actually copy data (default: dry-run mode)",
    )

    parser.add_argument(
        "--strict-counts",
        action="store_true",
        help="Fail if tenant rowcount differs from public rowcount after migration",
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

        manager = TenantManager(engine)

        try:
            results = manager.migrate_all_back_to_public(
                target_schema=args.target,
                dry_run=not args.commit,
                strict_counts=args.strict_counts,
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
