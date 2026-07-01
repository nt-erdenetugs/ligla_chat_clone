import contextvars
import logging
import re
from logging.config import fileConfig
from typing import Any

import sqlalchemy.exc
from sqlalchemy import text
from sqlalchemy.engine import URL

from alembic import context
from alembic.operations import Operations, toimpl
from alembic.operations.ops import (
    AddColumnOp,
    AddConstraintOp,
    AlterColumnOp,
    CreateForeignKeyOp,
    CreateIndexOp,
    CreateTableOp,
    DropColumnOp,
    DropConstraintOp,
    DropIndexOp,
    DropTableOp,
)
from alembic.script import ScriptDirectory
from app.db.base import Base  # noqa: F401  (imports all models for metadata)
from app.db.base_class import SCHEMA_TOKEN_TENANT
from app.db.migration_constants import LEGACY_TENANT_TABLES, SHARED_TABLES, TENANT_TABLES
from app.db.session import get_engine

# ============================================================================
# Logging Setup
# ============================================================================

logger = logging.getLogger("alembic.env")

# ============================================================================
# Context Variables and Helpers
# ============================================================================

_MIGRATION_SCHEMA_TYPE = contextvars.ContextVar("schema_type", default="public")


def is_public_context() -> bool:
    """Check if currently migrating public schema."""
    return _MIGRATION_SCHEMA_TYPE.get() == "public"


def _is_tenant_table(table_name: str | None) -> bool:
    """Check if table is a tenant-scoped table."""
    if table_name is None:
        return False
    return table_name in TENANT_TABLES or table_name in LEGACY_TENANT_TABLES


def _get_object_schema(obj: Any) -> str | None:
    """Extract schema from SQLAlchemy object."""
    if hasattr(obj, "schema") and obj.schema is not None:
        return obj.schema
    if hasattr(obj, "table") and hasattr(obj.table, "schema") and obj.table.schema is not None:
        return obj.table.schema
    if hasattr(obj, "parent") and hasattr(obj.parent, "schema") and obj.parent.schema is not None:
        return obj.parent.schema
    return None


def _should_include_in_tenant_migration(obj: Any, _: str | None, type_: str) -> bool:
    """Filter objects for tenant schema migrations."""
    if type_ == "schema":
        return True
    obj_schema = _get_object_schema(obj)
    if obj_schema == SCHEMA_TOKEN_TENANT:
        return True
    if obj_schema is not None and (obj_schema.startswith("org_") or obj_schema == "tenant_template"):
        return True
    return False


# ============================================================================
# Operation Filters for Multi-Tenant Support
# ============================================================================


@Operations.implementation_for(CreateTableOp, replace=True)
def filtered_create_table(operations: Operations, operation: CreateTableOp) -> Any:  # type: ignore[return]
    """Filter and adapt table creation for tenant contexts."""
    if is_public_context():
        return toimpl.create_table(operations, operation)

    table_name = operation.table_name
    table_schema = getattr(operation, "schema", None)
    is_tenant_table_by_name = _is_tenant_table(table_name)

    logger.debug(f"is_tenant_table_by_name={is_tenant_table_by_name}, SCHEMA_TOKEN_TENANT={SCHEMA_TOKEN_TENANT}")

    if table_schema != SCHEMA_TOKEN_TENANT and not is_tenant_table_by_name:
        logger.debug(f"SKIP create_table {table_name} (not a tenant table in tenant context)")
        return None

    target_schema = _MIGRATION_SCHEMA_TYPE.get()
    if target_schema != "public":
        operation = CreateTableOp(
            table_name=operation.table_name,
            columns=operation.columns,
            schema=target_schema,
            if_not_exists=operation.if_not_exists,
        )

    operations.get_bind().execute(text(f'SET search_path TO "{target_schema}", "$user", public'))
    return toimpl.create_table(operations, operation)


@Operations.implementation_for(DropTableOp, replace=True)
def filtered_drop_table(operations: Operations, operation: DropTableOp) -> None | Any:
    """Filter table drops for tenant contexts."""
    if is_public_context():
        return toimpl.drop_table(operations, operation)

    table_schema = getattr(operation, "schema", None) or getattr(operation.table_name, "schema", None)
    if table_schema != SCHEMA_TOKEN_TENANT and not _is_tenant_table(operation.table_name):
        logger.debug(f"SKIP drop_table {operation.table_name} (not a tenant table in tenant context)")
        return None

    target_schema = _MIGRATION_SCHEMA_TYPE.get()
    if target_schema != "public":
        operation = DropTableOp(
            table_name=operation.table_name,
            schema=target_schema,
            if_exists=operation.if_exists,
            table_kw=operation.table_kw,
        )

    operations.get_bind().execute(text(f'SET search_path TO "{target_schema}", "$user", public'))
    return toimpl.drop_table(operations, operation)


@Operations.implementation_for(CreateIndexOp, replace=True)
def filtered_create_index(operations: Operations, operation: CreateIndexOp) -> Any:  # type: ignore[return]
    """Filter index creation for tenant contexts."""
    if is_public_context():
        return toimpl.create_index(operations, operation)

    table_schema = getattr(operation, "schema", None) or getattr(operation.table_name, "schema", None)
    if table_schema != SCHEMA_TOKEN_TENANT and not _is_tenant_table(operation.table_name):
        logger.debug(f"SKIP create_index {operation.index_name} (not a tenant index in tenant context)")
        return None

    return toimpl.create_index(operations, operation)


@Operations.implementation_for(DropIndexOp, replace=True)
def filtered_drop_index(operations: Operations, operation: DropIndexOp) -> Any:  # type: ignore[return]
    """Filter index drops for tenant contexts."""
    if is_public_context():
        return toimpl.drop_index(operations, operation)

    table_schema = getattr(operation, "schema", None) or getattr(operation.table_name, "schema", None)
    if table_schema != SCHEMA_TOKEN_TENANT and not _is_tenant_table(operation.table_name):
        logger.debug(f"SKIP drop_index {operation.index_name} (not a tenant index in tenant context)")
        return None

    return toimpl.drop_index(operations, operation)


@Operations.implementation_for(AddColumnOp, replace=True)
def filtered_add_column(operations: Operations, operation: AddColumnOp) -> Any:  # type: ignore[return]
    """Filter column additions for tenant contexts."""
    if is_public_context():
        return toimpl.add_column(operations, operation)

    table_schema = getattr(operation, "schema", None) or getattr(operation.table_name, "schema", None)
    column_name = getattr(operation.column, "name", str(operation.column))

    if table_schema != SCHEMA_TOKEN_TENANT and not _is_tenant_table(operation.table_name):
        logger.debug(f"SKIP add_column {column_name} on {operation.table_name} (not a tenant table in tenant context)")
        return None

    # Skip obsolete migration
    if operation.table_name == "userPasswordResetToken" and column_name == "userId":
        logger.debug(f"SKIP add_column {column_name} on {operation.table_name} (obsolete migration)")
        return None

    return toimpl.add_column(operations, operation)


@Operations.implementation_for(AlterColumnOp, replace=True)
def filtered_alter_column(operations: Operations, operation: AlterColumnOp) -> Any:  # type: ignore[return]
    """Filter column alterations for tenant contexts."""
    if is_public_context():
        return toimpl.alter_column(operations, operation)

    table_schema = getattr(operation, "schema", None) or getattr(operation.table_name, "schema", None)
    column_name = getattr(operation.column_name, "name", str(operation.column_name))

    if table_schema != SCHEMA_TOKEN_TENANT and not _is_tenant_table(operation.table_name):
        logger.debug(
            f"SKIP alter_column {column_name} on {operation.table_name} (not a tenant table in tenant context)"
        )
        return None

    return toimpl.alter_column(operations, operation)


@Operations.implementation_for(DropColumnOp, replace=True)
def filtered_drop_column(operations: Operations, operation: DropColumnOp) -> Any:  # type: ignore[return]
    """Filter column drops for tenant contexts."""
    if is_public_context():
        return toimpl.drop_column(operations, operation)

    table_schema = getattr(operation, "schema", None) or getattr(operation.table_name, "schema", None)
    column_name = getattr(operation.column_name, "name", str(operation.column_name))

    if table_schema != SCHEMA_TOKEN_TENANT and not _is_tenant_table(operation.table_name):
        logger.debug(f"SKIP drop_column {column_name} on {operation.table_name} (not a tenant table in tenant context)")
        return None

    return toimpl.drop_column(operations, operation)


@Operations.implementation_for(CreateForeignKeyOp, replace=True)
def filtered_create_foreign_key(operations: Operations, operation: CreateForeignKeyOp) -> None | Any:
    """Filter foreign key creation for tenant contexts."""
    if is_public_context():
        return toimpl.create_constraint(operations, operation)

    table_schema = getattr(operation, "schema", None) or getattr(operation.source_table, "schema", None)
    if table_schema != SCHEMA_TOKEN_TENANT and not _is_tenant_table(operation.source_table):
        logger.debug("SKIP create_foreign_key (not a tenant table in tenant context)")
        return None

    return toimpl.create_constraint(operations, operation)


@Operations.implementation_for(AddConstraintOp, replace=True)
def filtered_add_constraint(operations: Operations, operation: AddConstraintOp) -> None | Any:
    """Filter constraint addition (unique, check) for tenant contexts."""
    if is_public_context():
        return toimpl.create_constraint(operations, operation)

    table_name = operation.table_name
    if not _is_tenant_table(table_name):
        logger.debug(f"SKIP add_constraint on {table_name} (not a tenant table in tenant context)")
        return None

    return toimpl.create_constraint(operations, operation)


@Operations.implementation_for(DropConstraintOp, replace=True)
def filtered_drop_constraint(operations: Operations, operation: DropConstraintOp) -> None | Any:
    """Filter constraint drops for tenant contexts."""
    if is_public_context():
        return toimpl.drop_constraint(operations, operation)

    table_schema = getattr(operation, "schema", None) or getattr(operation.table_name, "schema", None)
    if table_schema != SCHEMA_TOKEN_TENANT and not _is_tenant_table(operation.table_name):
        logger.debug(f"SKIP drop_constraint {operation.constraint_name} (not a tenant table in tenant context)")
        return None

    return toimpl.drop_constraint(operations, operation)


# ============================================================================
# SQL Translation for Schema-Per-Tenant Pattern
# ============================================================================

_execute_ref: list[Any] = [None]


def _translate_sql_schema(sql: str, target_schema: str) -> str:
    """Translate SQL references from public schema to target tenant schema."""
    if target_schema == "public" or target_schema == SCHEMA_TOKEN_TENANT:
        return sql

    translated = sql
    for table in TENANT_TABLES:
        replacement = f'"{target_schema}"."{table}"'
        public_pattern = f'"public"."{table}"'
        unqualified_pattern = rf'(?<!\.)"{re.escape(table)}"'

        if public_pattern in translated:
            translated = translated.replace(public_pattern, replacement)

        if re.search(unqualified_pattern, translated):
            translated = re.sub(unqualified_pattern, replacement, translated)

    return translated


def _register_execute_filter():
    """Register SQL execution filter for tenant-aware schema translation."""
    if _execute_ref[0] is not None:
        return

    from alembic.ddl.impl import DefaultImpl

    _execute_ref[0] = DefaultImpl.execute

    def filtered_execute(self: Any, sql: Any, **kwargs: Any) -> Any:
        sql_str = str(sql)

        if is_public_context():
            return _execute_ref[0](self, sql, **kwargs)

        target_schema = _MIGRATION_SCHEMA_TYPE.get()

        # Check if SQL references shared tables
        contains_shared_table = any(
            f'"public"."{table}"' in sql_str or f'"{table}"' in sql_str for table in SHARED_TABLES
        )

        if contains_shared_table:
            # Allow tenant table creation that references shared tables
            is_tenant_table_creation = any(
                f'CREATE TABLE "{table}"' in sql_str or f'CREATE TABLE "{target_schema}"."{table}"' in sql_str
                for table in TENANT_TABLES
            )

            if is_tenant_table_creation:
                sql_str = _translate_sql_schema(sql_str, target_schema)
                if sql_str != str(sql):
                    logger.info("Translated tenant table creation SQL referencing shared tables")
                return _execute_ref[0](self, sql_str, **kwargs)
            else:
                logger.debug("SKIP execute SQL mentioning shared tables (non-table-creation operation)")
                return

        # Translate schema references for tenant context
        if target_schema != "public":
            sql_str = _translate_sql_schema(sql_str, target_schema)
            if sql_str != str(sql):
                logger.info(f"Translated SQL for tenant schema {target_schema}")

        return _execute_ref[0](self, sql_str, **kwargs)

    DefaultImpl.execute = filtered_execute  # type: ignore[method-assign]


_register_execute_filter()


# ============================================================================
# Revision-Based Migration Filtering
# ============================================================================

# Migrations that should be completely skipped in tenant schemas
TENANT_SKIP_REVISIONS = {
    "d99d92de316a",  # add survey tables - memberFeedData operations not needed in tenant schemas
}

# The migration that introduced tenant schemas; downgrading past it drops all tenant schemas
TENANT_INTRODUCTION_REV = "de1fc187c8b7"


def process_revision_directives(context, revision, directives):
    """Skip specific revisions when running in tenant schema context."""
    if is_public_context():
        return

    # Get current migration revision from the first directive
    if directives and len(directives) > 0:
        script = directives[0]
        if hasattr(script, "rev_id") and script.rev_id in TENANT_SKIP_REVISIONS:
            target_schema = _MIGRATION_SCHEMA_TYPE.get()
            logger.debug(f"SKIP entire migration {script.rev_id} in tenant schema {target_schema}")
            directives[:] = []


# ============================================================================
# Migration Logging and Status Tracking
# ============================================================================


def get_head_revision_id() -> str:
    """Get current head revision ID from migration scripts."""
    script = ScriptDirectory.from_config(config)
    head = script.get_current_head()
    return str(head) if head else "none"


def get_last_migration_status(engine: Any, schema: str) -> str | None:
    """Get last recorded migration status for a schema."""
    try:
        with engine.connect() as conn:
            has_table = conn.execute(
                text(
                    (
                        "SELECT EXISTS (SELECT FROM information_schema.tables "
                        "WHERE table_schema = 'public' AND table_name = 'organizationMigration')"
                    )
                )
            ).scalar()

            if not has_table:
                return None

            head_rev = get_head_revision_id()
            result = conn.execute(
                text(
                    'SELECT "lastStatus" FROM public."organizationMigration" '
                    'WHERE "schemaName" = :schema AND "lastRevision" = :revision'
                ),
                {"schema": schema, "revision": head_rev},
            ).fetchone()

            return result[0] if result else None
    except Exception as e:
        logger.warning(f"Could not get migration status for {schema}: {e}")
        return None


def log_migration_status(connection: Any, schema: str, status: str, error: Any = None) -> None:
    """Log migration status to organizationMigration table."""
    try:
        has_table = connection.execute(
            text(
                (
                    "SELECT EXISTS (SELECT FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name = 'organizationMigration')"
                )
            )
        ).scalar()

        if not has_table:
            return

        head_rev = get_head_revision_id()

        if status == "STARTED":
            connection.execute(
                text(
                    'INSERT INTO public."organizationMigration" '
                    '("schemaName", "lastRevision", "lastStatus", "startedAt") '
                    "VALUES (:schema, :revision, :status, NOW()) "
                    'ON CONFLICT ("schemaName") WHERE "schemaName" IS NOT NULL '
                    "DO UPDATE SET "
                    '"lastRevision" = EXCLUDED."lastRevision", '
                    '"lastStatus" = EXCLUDED."lastStatus", '
                    '"startedAt" = EXCLUDED."startedAt", '
                    '"finishedAt" = NULL, '
                    '"lastError" = NULL'
                ),
                {"schema": schema, "revision": head_rev, "status": status},
            )
        else:
            connection.execute(
                text(
                    'UPDATE public."organizationMigration" '
                    'SET "lastStatus" = :status, "finishedAt" = NOW(), "lastError" = :error '
                    'WHERE "schemaName" = :schema AND "lastRevision" = :revision '
                    "AND \"lastStatus\" = 'STARTED'"
                ),
                {"schema": schema, "revision": head_rev, "status": status, "error": str(error) if error else None},
            )
    except Exception as e:
        logger.warning(f"Could not log migration status for {schema}: {e}")


# ============================================================================
# Database Connection and Schema Utilities
# ============================================================================


def get_url() -> str:
    """Get database URL without schema parameter."""
    url = get_engine().url
    if url.query and "schema" in url.query:
        url = URL.create(
            drivername=url.drivername,
            username=url.username,
            password=url.password,
            host=url.host,
            port=url.port,
            database=url.database,
            query={k: v for k, v in url.query.items() if k != "schema"},
        )
    return str(url)


def get_tenant_schemas(connection: Any) -> list[str]:
    """Fetch list of tenant schema names from organization table or existing schemas."""
    try:
        # Use nested transaction (SAVEPOINT) to safely handle potential errors
        # (e.g. table not found) without aborting the main transaction
        with connection.begin_nested():
            # First try using organization.id (if it exists - post migration 4dc6367cdcb4)
            result = connection.execute(text("SELECT id FROM public.organization"))
            return [f"org_{str(row[0]).replace('-', '').lower()}" for row in result]
    except Exception as primary_err:
        # Fallback: Query pg_namespace for existing org_* schemas
        try:
            result = connection.execute(
                text("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'org_%' ORDER BY nspname")
            )
            return [row[0] for row in result]
        except Exception as fallback_err:
            raise RuntimeError(
                f"Failed to fetch tenant schemas. Primary: {primary_err}, Fallback: {fallback_err}"
            ) from fallback_err


# ============================================================================
# Alembic Configuration
# ============================================================================

config = context.config

if config.config_file_name is not None:
    try:
        fileConfig(config.config_file_name)
    except KeyError:
        logger.debug("No logging config section in %s, skipping fileConfig", config.config_file_name)

target_metadata = Base.metadata


# ============================================================================
# Migration Execution
# ============================================================================


def run_migrations_offline():
    """Run migrations in 'offline' mode (SQL script generation)."""
    url = get_url()
    tenant_schema = context.get_x_argument(as_dictionary=True).get("tenant")
    schema_translate_map = {SCHEMA_TOKEN_TENANT: tenant_schema, None: "public"} if tenant_schema else None

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
        include_schemas=True,
        version_table_schema=tenant_schema or "public",
        schema_translate_map=schema_translate_map,
    )

    with context.begin_transaction():
        context.run_migrations()


def _drop_all_tenant_schemas(connection: Any) -> None:
    """Drop all tenant schemas (org_* and tenant_template)."""
    logger.info("Dropping all tenant schemas...")

    tenant_schemas = get_tenant_schemas(connection)
    if "tenant_template" in tenant_schemas:
        tenant_schemas.remove("tenant_template")
    tenant_schemas.append("tenant_template")  # Drop template last

    failed_schemas = []
    for schema in tenant_schemas:
        try:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
            logger.info(f"Dropped schema: {schema}")
        except Exception as e:
            logger.error(f"Failed to drop schema {schema}: {e}")
            failed_schemas.append(schema)

    if failed_schemas:
        raise RuntimeError(
            f"Failed to drop {len(failed_schemas)} tenant schemas: {failed_schemas}. "
            "Database may be in inconsistent state."
        )

    logger.info(f"All {len(tenant_schemas)} tenant schemas dropped successfully")


MIGRATION_LOCK_TIMEOUT = "10s"
MIGRATION_STATEMENT_TIMEOUT = "10min"


def _execute_migration(connection, schema: str, context_obj) -> None:
    connection.execute(text(f"SET LOCAL lock_timeout = '{MIGRATION_LOCK_TIMEOUT}'"))
    connection.execute(text(f"SET LOCAL statement_timeout = '{MIGRATION_STATEMENT_TIMEOUT}'"))
    _MIGRATION_SCHEMA_TYPE.set(schema)

    log_migration_status(connection, schema, "STARTED")
    try:
        context_obj.run_migrations()
        _clear_downgraded_migration_status(connection, schema)
        log_migration_status(connection, schema, "SUCCESS")
    except Exception as e:
        log_migration_status(connection, schema, "FAILURE", e)
        raise


def _clear_downgraded_migration_status(connection: Any, schema: str) -> None:
    """Clear stale organizationMigration record when schema revision lags behind HEAD."""
    if schema == "public":
        return
    try:
        head_rev = get_head_revision_id()
        safe_schema = schema.replace('"', '""')
        result = connection.execute(text(f'SELECT version_num FROM "{safe_schema}".alembic_version')).fetchone()
        actual_rev = result[0] if result else None
        if actual_rev and actual_rev != head_rev:
            connection.execute(
                text('DELETE FROM public."organizationMigration" WHERE "schemaName" = :schema'),
                {"schema": schema},
            )
            logger.info(f"Cleared migration status for {schema} (at {actual_rev}, not HEAD {head_rev})")
    except sqlalchemy.exc.ProgrammingError:
        logger.debug(f"Could not check migration status for {schema} (alembic_version table may not exist)")
    except sqlalchemy.exc.SQLAlchemyError as e:
        logger.warning(f"Unexpected error checking migration status for {schema}: {e}")


def run_migrations_online():
    """Run migrations in 'online' mode (direct database connection)."""
    connectable = get_engine()

    x_args = context.get_x_argument(as_dictionary=True)
    tenant_env = config.attributes.get("tenant_schema", None)
    skip_public_attr = bool(config.attributes.get("skip_public_migration", False))
    skip_public_x = str(x_args.get("skip_public_migration", "")).lower() in {"1", "true", "yes", "on"}
    skip_public_migration = skip_public_attr or skip_public_x
    tenant_x = x_args.get("tenant")
    target_tenant = tenant_x or tenant_env
    only_public = target_tenant == "public"
    tenant_only_mode = bool(target_tenant and target_tenant != "public" and skip_public_migration)

    if skip_public_migration and not target_tenant:
        raise RuntimeError("skip_public_migration requested but no target tenant was resolved")

    logger.debug(
        "Alembic target resolution: tenant_x=%s tenant_env=%s target_tenant=%s tenant_only_mode=%s",
        tenant_x,
        tenant_env,
        target_tenant,
        tenant_only_mode,
    )

    # Check if downgrading past tenant schema introduction (de1fc187c8b7)
    # This check must be done OUTSIDE the connection context to avoid transaction issues
    target_rev = context.get_tag_argument() or context.get_x_argument(as_dictionary=True).get("target_rev")

    should_drop_tenants = False
    if target_rev:
        # Check if target revision is at or before de1fc187c8b7
        script = ScriptDirectory.from_config(config)
        try:
            # Get current head
            current_head = get_head_revision_id()

            # Walk revisions from target to current head
            # If de1fc187c8b7 is found in the path, we're downgrading past it
            revisions_to_walk = list(script.walk_revisions(target_rev, current_head))
            rev_ids = [str(rev.revision) for rev in revisions_to_walk]

            if TENANT_INTRODUCTION_REV in rev_ids or target_rev == TENANT_INTRODUCTION_REV:
                should_drop_tenants = True
                logger.warning(f"Downgrading to {target_rev} (at or before {TENANT_INTRODUCTION_REV})")
                logger.warning("This will drop all tenant schemas after public schema migration completes")
        except Exception as e:
            logger.warning(f"Could not determine revision path: {e}")

    with connectable.connect() as connection:
        # Check if public schema needs migration
        force = context.get_x_argument(as_dictionary=True).get("force") == "true"

        # Get current public schema revision
        public_current_rev = None
        # Check if alembic_version table exists without causing transaction abort
        has_version_table = connection.execute(
            text(
                "SELECT EXISTS (SELECT FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = 'alembic_version')"
            )
        ).scalar()

        if has_version_table:
            result = connection.execute(text("SELECT version_num FROM public.alembic_version")).fetchone()
            public_current_rev = result[0] if result else None

        head_rev = get_head_revision_id()
        skip_public = (
            public_current_rev == head_rev
            and not force
            and not only_public
            and target_tenant  # Only skip when upgrading specific tenant
        )
        if tenant_only_mode:
            skip_public = True

        if skip_public:
            if tenant_only_mode:
                logger.info(f"Skipping public schema (tenant-only mode for {target_tenant})")
            else:
                logger.info(f"Skipping public schema (already at {head_rev})")
        else:
            # Migrate public schema
            logger.info(
                "Migrating public schema only (skipping tenant schemas)" if only_public else "Migrating public schema"
            )

            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
                compare_server_default=True,
                include_schemas=True,
                version_table_schema="public",
                include_object=lambda obj, name, type_, reflected, compare_to: (
                    getattr(obj, "schema", None) == "public"
                    or type_ == "schema"
                    or (type_ == "table" and reflected and compare_to is None)
                ),
            )

            with context.begin_transaction():
                _execute_migration(connection, "public", context)

            # After public migration, drop tenant schemas if downgrading past tenant introduction
            if should_drop_tenants:
                _drop_all_tenant_schemas(connection)
                connection.commit()
                # Don't migrate tenant schemas after dropping them
                return

            # Commit public schema migrations before returning (if only migrating public)
            if only_public:
                connection.commit()
                return

        # Migrate tenant schemas
        if target_tenant and target_tenant != "public":
            tenants = [target_tenant]
        else:
            tenants = get_tenant_schemas(connection)
            if "tenant_template" not in tenants:
                tenants.append("tenant_template")

        force = context.get_x_argument(as_dictionary=True).get("force") == "true"

        head_rev = get_head_revision_id()

        for schema in tenants:
            last_status = get_last_migration_status(connectable, schema)
            if last_status == "SUCCESS" and not force:
                # Verify the schema's actual alembic_version matches head before skipping.
                # log_migration_status always records the script head revision, so if a partial
                # upgrade was run (e.g. alembic upgrade <pre-encryption-rev>), the status table
                # says SUCCESS for head even though the schema is behind.
                try:
                    schema_rev = connection.execute(
                        text(f'SELECT version_num FROM "{schema}".alembic_version')
                    ).scalar()
                except Exception:
                    schema_rev = None

                if schema_rev == head_rev:
                    logger.info(f"Skipping {schema} (already migrated)")
                    continue
                else:
                    logger.info(
                        f"Schema {schema} status is SUCCESS but at revision {schema_rev}, "
                        f"not {head_rev}. Proceeding with migration."
                    )

            logger.info(f"Migrating tenant schema: {schema}")

            connection.execute(text('CREATE SCHEMA IF NOT EXISTS "' + schema.replace('"', '""') + '"'))
            connection.commit()
            logger.debug(f"Created schema: {schema}")

            schema_translate_map = {SCHEMA_TOKEN_TENANT: schema}
            tenant_connection = connection.execution_options(schema_translate_map=schema_translate_map)

            context.configure(
                connection=tenant_connection,
                target_metadata=target_metadata,
                compare_type=True,
                compare_server_default=True,
                include_schemas=True,
                version_table_schema=schema,
                schema_translate_map=schema_translate_map,
                include_object=lambda obj, name, type_, reflected, compare_to: _should_include_in_tenant_migration(
                    obj, name, type_
                ),
                process_revision_directives=process_revision_directives,
            )

            with context.begin_transaction():
                _execute_migration(connection, schema, context)

        connection.commit()


# ============================================================================
# Entry Point
# ============================================================================

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
