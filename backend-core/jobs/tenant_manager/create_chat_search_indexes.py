import argparse
import logging
import sys

from app.config.settings import settings
from app.db.session import get_engine_for_parallel_operations
from app.services.encryption import EncryptionService
from jobs.tenant_manager.manager import TenantManager
from jobs.tenant_manager.operations.search_index import SEARCH_INDEX_MODE_CREATE, SEARCH_INDEX_MODES
from jobs.tenant_manager.utils import ensure_environment

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Manage tenant chat search indexes for encrypted chat messages",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--commit",
        action="store_true",
        help="Apply the requested index change (default: dry-run mode)",
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

    parser.add_argument(
        "--mode",
        choices=SEARCH_INDEX_MODES,
        default=SEARCH_INDEX_MODE_CREATE,
        help="Index action: create (default), replace, or drop",
    )

    return parser.parse_args()


def main(args: argparse.Namespace | None = None) -> int:
    if args is None:
        args = parse_args()

    engine = get_engine_for_parallel_operations()
    try:
        ensure_environment(engine)

        try:
            encryption_service = EncryptionService(settings)
        except Exception as e:
            logger.error("Error initializing EncryptionService: %s", e)
            logger.info("Ensure ENCRYPTION_MASTER_KEY is set in the environment.")
            return 1

        manager = TenantManager(engine)

        try:
            results = manager.create_chat_search_indexes(
                encryption_service=encryption_service,
                dry_run=not args.commit,
                max_workers=args.workers,
                continue_on_error=args.continue_on_error,
                mode=args.mode,
            )
            has_errors = any(not result.is_success for result in results.values())
            return 1 if has_errors else 0
        except Exception as e:
            logger.error("Error: %s", e)
            return 1
    finally:
        # Release the pool so the job stops holding Cloud SQL connections.
        engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
