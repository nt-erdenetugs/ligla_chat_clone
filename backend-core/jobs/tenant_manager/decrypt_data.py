import argparse
import logging
import sys

from app.config.settings import settings
from app.db.session import get_engine_for_parallel_operations
from app.services.encryption import EncryptionService
from jobs.tenant_manager.manager import TenantManager
from jobs.tenant_manager.utils import ensure_environment, has_operation_errors

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Decrypt existing encrypted data in tenant schemas",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--commit",
        action="store_true",
        help="Actually decrypt data (default: dry-run mode)",
    )

    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of parallel workers (default: 1; auto-clamped to the job DB pool, effective max 4)",
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of rows to process per batch (default: 100)",
    )

    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Continue processing other organizations if one fails",
    )

    parser.add_argument(
        "--inter-batch-sleep",
        type=float,
        default=0.0,
        help="Seconds to sleep between batches to throttle DB load (default: 0.0)",
    )

    return parser.parse_args()


def main(args: argparse.Namespace | None = None) -> int:
    if args is None:
        args = parse_args()

    engine = get_engine_for_parallel_operations()
    try:
        ensure_environment(engine)

        # Initialize encryption service
        try:
            encryption_service = EncryptionService(settings)
        except Exception as e:
            logger.error("Error initializing EncryptionService: %s", e)
            logger.info("Ensure ENCRYPTION_MASTER_KEY is set in the environment.")
            return 1

        manager = TenantManager(engine)

        try:
            results = manager.decrypt_all_schemas(
                encryption_service=encryption_service,
                dry_run=not args.commit,
                max_workers=args.workers,
                batch_size=args.batch_size,
                continue_on_error=args.continue_on_error,
                inter_batch_sleep_seconds=args.inter_batch_sleep,
            )

            has_errors = has_operation_errors(results)

            return 1 if has_errors else 0

        except Exception as e:
            logger.error("Error: %s", e)
            return 1
    finally:
        # Release the pool so the job stops holding Cloud SQL connections.
        engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
