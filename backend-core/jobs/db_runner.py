#!/usr/bin/env python3
from __future__ import annotations

import argparse
import logging
import os
import sys
import traceback

from jobs.logging_utils import configure_jobs_logging


configure_jobs_logging()

logger = logging.getLogger(__name__)


def _print_phase_error(phase_name: str, exception: Exception) -> None:
    separator = "=" * 60
    logger.error(
        "\n%s\nERROR: %s\n%s\nException: %s: %s\n\nFull traceback:\n%s%s",
        separator,
        phase_name,
        separator,
        type(exception).__name__,
        exception,
        traceback.format_exc(),
        separator,
    )


def main() -> int:
    # DB_JOB_COMMAND format: comma-separated args (e.g. "migrate-up,--revision,head")
    env_command = os.environ.get("DB_JOB_COMMAND", "").strip()
    if len(sys.argv) == 1:
        if not env_command:
            logger.error("ERROR: No command specified. Set DB_JOB_COMMAND env var or pass command as argument.")
            logger.info("Example: DB_JOB_COMMAND=migrate-up,--revision,head")
            logger.info(
                "Available: migrate-up, migrate-down, tenant-sync, tenant-migrate, tenant-validate, tenant-rollback, tenant-encrypt, tenant-decrypt, tenant-chat-search-indexes, tenant-setup-full"
            )
            return 1
        sys.argv.extend(env_command.split(","))

    parser = argparse.ArgumentParser(description="Unified database operations runner")
    subparsers = parser.add_subparsers(dest="command", required=True)

    up = subparsers.add_parser("migrate-up", help="Run Alembic upgrade")
    up.add_argument("--revision", default="head")

    down = subparsers.add_parser("migrate-down", help="Run Alembic downgrade")
    down.add_argument("--revision", default="-1")

    subparsers.add_parser("tenant-sync", help="Sync template schema to tenants")

    migrate = subparsers.add_parser("tenant-migrate", help="Migrate data to tenant schemas")
    migrate.add_argument("--source", default="public_old")
    migrate.add_argument("--commit", action="store_true")
    migrate.add_argument("--workers", type=int, default=4, help="Number of parallel workers (default: 4)")

    validate = subparsers.add_parser("tenant-validate", help="Validate tenant data")
    validate.add_argument("--deep", action="store_true")

    rollback = subparsers.add_parser("tenant-rollback", help="Rollback data to public schema")
    rollback.add_argument("--target", default="public_old")
    rollback.add_argument("--commit", action="store_true")
    rollback.add_argument("--workers", type=int, default=4, help="Number of parallel workers (default: 4)")

    setup = subparsers.add_parser("tenant-setup-full", help="Complete tenant setup: migrate + copy data + validate")
    setup.add_argument("--source", default="public_old", help="Source schema for data migration")
    setup.add_argument("--skip-validate", action="store_true", help="Skip validation step")
    setup.add_argument("--workers", type=int, default=4, help="Number of parallel workers (default: 4)")

    encrypt = subparsers.add_parser("tenant-encrypt", help="Encrypt existing unencrypted data in tenant schemas")
    encrypt.add_argument("--commit", action="store_true", help="Actually encrypt data (default: dry-run)")
    encrypt.add_argument("--workers", type=int, default=4, help="Number of parallel workers (default: 4)")
    encrypt.add_argument("--batch-size", type=int, default=1000, help="Rows per batch (default: 1000)")
    encrypt.add_argument("--continue-on-error", action="store_true", help="Continue if one org fails")
    encrypt.add_argument("--inter-batch-sleep", type=float, default=0.0, help="Sleep between batches (default: 0.0)")

    decrypt = subparsers.add_parser("tenant-decrypt", help="Decrypt existing encrypted data in tenant schemas")
    decrypt.add_argument("--commit", action="store_true", help="Actually decrypt data (default: dry-run)")
    decrypt.add_argument("--workers", type=int, default=4, help="Number of parallel workers (default: 4)")
    decrypt.add_argument("--batch-size", type=int, default=1000, help="Rows per batch (default: 1000)")
    decrypt.add_argument("--continue-on-error", action="store_true", help="Continue if one org fails")
    decrypt.add_argument("--inter-batch-sleep", type=float, default=0.0, help="Sleep between batches (default: 0.0)")

    chat_search_indexes = subparsers.add_parser(
        "tenant-chat-search-indexes",
        help="Manage tenant chat search indexes for encrypted messages",
    )
    chat_search_indexes.add_argument(
        "--commit", action="store_true", help="Apply the requested index change (default: dry-run)"
    )
    chat_search_indexes.add_argument("--workers", type=int, default=4, help="Number of parallel workers (default: 4)")
    chat_search_indexes.add_argument("--continue-on-error", action="store_true", help="Continue if one org fails")
    chat_search_indexes.add_argument(
        "--mode",
        choices=("create", "replace", "drop"),
        default="create",
        help="Index action: create (default), replace, or drop",
    )

    tenant_down = subparsers.add_parser("tenant-downgrade-all", help="Downgrade all tenant schemas to a revision")
    tenant_down.add_argument("--revision", default="-1")

    fix_aliases = subparsers.add_parser(
        "fix-column-aliases", help="Fix camelCase aliases in memberFeed/survey settings"
    )
    fix_aliases.add_argument("--commit", action="store_true", help="Apply changes (default: dry run)")

    args = parser.parse_args()

    if args.command == "migrate-up":
        from jobs.alembic_runner import run_migrations

        return run_migrations("up", args.revision)

    elif args.command == "migrate-down":
        from jobs.alembic_runner import run_migrations

        return run_migrations("down", args.revision)

    elif args.command == "tenant-sync":
        from jobs.tenant_manager.sync_template import main as sync_main

        sync_args = argparse.Namespace(template="tenant_template", tenant=None, dry_run=False)
        return sync_main(sync_args)

    elif args.command == "tenant-migrate":
        from jobs.tenant_manager.migrate_data import main as migrate_main

        migrate_args = argparse.Namespace(
            source=args.source, commit=args.commit, workers=args.workers, continue_on_error=False
        )
        return migrate_main(migrate_args)

    elif args.command == "tenant-validate":
        from jobs.tenant_manager.validate import main as validate_main

        validate_args = argparse.Namespace(org=None, source="public_old", deep=args.deep)
        return validate_main(validate_args)

    elif args.command == "tenant-rollback":
        from jobs.tenant_manager.migrate_data_back import main as rollback_main

        rollback_args = argparse.Namespace(
            target=args.target, commit=args.commit, strict_counts=False, workers=args.workers, continue_on_error=False
        )
        return rollback_main(rollback_args)

    elif args.command == "tenant-downgrade-all":
        from jobs.alembic_runner import run_tenant_downgrade_all

        return run_tenant_downgrade_all(args.revision)

    elif args.command == "fix-column-aliases":
        from jobs.fix_column_aliases import main as fix_main

        return fix_main(args)

    elif args.command == "tenant-setup-full":
        logger.info("Starting tenant setup full workflow...")

        # Step 1: Run migrations
        logger.info("\n[1/3] Running migrations to head...")
        try:
            from jobs.alembic_runner import run_migrations

            result = run_migrations("up", "head")
            if result != 0:
                logger.error("ERROR: Migration failed - see logs above for details")
                return result
        except Exception as e:
            _print_phase_error("Migration failed at Phase 1 (Alembic DDL)", e)
            return 1
        logger.info("[1/3] Migrations complete")

        # Step 2: Migrate data
        logger.info("\n[2/3] Migrating data from %s...", args.source)
        try:
            from jobs.tenant_manager.migrate_data import main as migrate_main

            migrate_args = argparse.Namespace(
                source=args.source, commit=True, workers=args.workers, continue_on_error=False
            )
            result = migrate_main(migrate_args)
            if result != 0:
                logger.error("ERROR: Data migration failed - see logs above for details")
                return result
        except Exception as e:
            _print_phase_error("Data migration failed at Phase 2", e)
            return 1
        logger.info("[2/3] Data migration complete")

        # Step 3: Validate (unless skipped)
        if not args.skip_validate:
            logger.info("\n[3/3] Validating tenant data...")
            try:
                from jobs.tenant_manager.validate import main as validate_main

                validate_args = argparse.Namespace(org=None, source="public_old", deep=True)
                result = validate_main(validate_args)
                if result != 0:
                    logger.error("ERROR: Validation failed - row count or checksum mismatch detected")
                    logger.info("To rollback: ./deploy-local.sh tenant-rollback")
                    return 1
            except Exception as e:
                _print_phase_error("Validation failed at Phase 3", e)
                return 1
            logger.info("[3/3] Validation complete")
        else:
            logger.info("\n[3/3] Validation skipped")

        logger.info("\nTenant setup complete")
        return 0

    elif args.command == "tenant-encrypt":
        from jobs.tenant_manager.encrypt_data import main as encrypt_main

        encrypt_args = argparse.Namespace(
            commit=args.commit,
            workers=args.workers,
            batch_size=args.batch_size,
            continue_on_error=args.continue_on_error,
            inter_batch_sleep=args.inter_batch_sleep,
        )
        return encrypt_main(encrypt_args)

    elif args.command == "tenant-decrypt":
        from jobs.tenant_manager.decrypt_data import main as decrypt_main

        decrypt_args = argparse.Namespace(
            commit=args.commit,
            workers=args.workers,
            batch_size=args.batch_size,
            continue_on_error=args.continue_on_error,
            inter_batch_sleep=args.inter_batch_sleep,
        )
        return decrypt_main(decrypt_args)

    elif args.command == "tenant-chat-search-indexes":
        from jobs.tenant_manager.create_chat_search_indexes import main as create_chat_search_indexes_main

        create_index_args = argparse.Namespace(
            commit=args.commit,
            workers=args.workers,
            continue_on_error=args.continue_on_error,
            mode=args.mode,
        )
        return create_chat_search_indexes_main(create_index_args)

    return 1


if __name__ == "__main__":
    sys.exit(main())
