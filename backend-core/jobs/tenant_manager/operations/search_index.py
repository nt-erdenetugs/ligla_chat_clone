from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from app.db.encryption_constants import (
    CHAT_ATTRIBUTE_VALUE_SEARCH_FUNCTION_SQL,
    CHAT_ATTRIBUTE_VALUE_SEARCH_INDEX,
    CHAT_ATTRIBUTE_VALUE_SEARCH_LOCK_KEY,
    CHAT_MESSAGE_SEARCH_FUNCTION_SQL,
    CHAT_MESSAGE_SEARCH_INDEX,
    CHAT_MESSAGE_SEARCH_LOCK_KEY,
    NOTE_SEARCH_FUNCTION_SQL,
    NOTE_SEARCH_INDEX,
    NOTE_SEARCH_LOCK_KEY,
    SET_ORG_KEY_SESSION_SQL,
)
from app.services.encryption import EncryptionService
from jobs.tenant_manager.operations.introspection import drop_index_if_invalid, table_exists

logger = logging.getLogger(__name__)

ADVISORY_LOCK_SQL = text("SELECT pg_advisory_xact_lock(:lock_key)")
CHAT_MESSAGE_SEARCH_FUNCTION_STATEMENT = text(CHAT_MESSAGE_SEARCH_FUNCTION_SQL)
NOTE_SEARCH_FUNCTION_STATEMENT = text(NOTE_SEARCH_FUNCTION_SQL)
CHAT_ATTRIBUTE_VALUE_SEARCH_FUNCTION_STATEMENT = text(CHAT_ATTRIBUTE_VALUE_SEARCH_FUNCTION_SQL)

LOCK_CHAT_MESSAGE_SEARCH_FUNCTION_SQL = ADVISORY_LOCK_SQL

# Indexes are built with CREATE INDEX CONCURRENTLY so the build never holds a write
# lock on the table. Partial GIN indexes (WHERE "isEncrypted" = true) can safely be
# created BEFORE the encryption job runs: PostgreSQL auto-inserts rows into the
# partial index when the WHERE predicate flips from false to true on UPDATE. CREATE
# mode is therefore idempotent regardless of how many rows currently match. REPLACE
# is only needed when the index expression or WHERE clause changes (full rebuild).
SEARCH_INDEX_MODE_CREATE = "create"
SEARCH_INDEX_MODE_REPLACE = "replace"
SEARCH_INDEX_MODE_DROP = "drop"
SEARCH_INDEX_MODES = (
    SEARCH_INDEX_MODE_CREATE,
    SEARCH_INDEX_MODE_REPLACE,
    SEARCH_INDEX_MODE_DROP,
)


@dataclass(frozen=True)
class SearchIndexSpec:
    table: str
    content_column: str
    index_name: str
    helper_function: str
    where_clause: str
    needs_org_key: bool = True


# All specs target the BYTEA `*Encrypted` column added by migration 0128c7c6877c.
# The plaintext column stays intact during the rollout; only encrypted rows need
# the bigm index (where_clause filters on isEncrypted=true). Helper-function
# creation is deferred to the cleanup release, so _has_search_prerequisites
# no-ops the build until those functions land.
CHAT_MESSAGE_SEARCH_SPEC = SearchIndexSpec(
    table="chatMessage",
    content_column="contentEncrypted",
    index_name=CHAT_MESSAGE_SEARCH_INDEX,
    helper_function="public.chat_message_search_text",
    where_clause='"isEncrypted" = true AND "type" = \'TEXT\'',
)

NOTE_SEARCH_SPEC = SearchIndexSpec(
    table="note",
    content_column="noteValueEncrypted",
    index_name=NOTE_SEARCH_INDEX,
    helper_function="public.note_search_text",
    where_clause='"isEncrypted" = true AND "isActive" = true',
)

CHAT_ATTRIBUTE_VALUE_SEARCH_SPEC = SearchIndexSpec(
    table="chatAttributeValue",
    content_column="valueEncrypted",
    index_name=CHAT_ATTRIBUTE_VALUE_SEARCH_INDEX,
    helper_function="public.chat_attribute_value_search_text",
    where_clause='"isEncrypted" = true',
)


@dataclass(kw_only=True, frozen=True)
class SearchIndexResult:
    schema: str
    index_name: str
    encrypted_row_count: int
    created: bool
    already_exists: bool
    table: str
    removed: bool = False
    action: Literal["create", "replace", "drop"] = SEARCH_INDEX_MODE_CREATE
    error: str | None = None

    @property
    def is_success(self) -> bool:
        return self.error is None


def _has_search_prerequisites(conn: Connection, helper_function: str) -> tuple[bool, str | None]:
    has_bigm = bool(conn.execute(text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_bigm')")).scalar())
    if not has_bigm:
        return False, "pg_bigm extension is missing; enable pg_bigm before creating search indexes"

    has_pgcrypto = bool(
        conn.execute(text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')")).scalar()
    )
    if not has_pgcrypto:
        return False, "pgcrypto extension is missing; run the encryption migration first"

    has_helper_fn = bool(conn.execute(text(f"SELECT to_regprocedure('{helper_function}(bytea)') IS NOT NULL")).scalar())
    if not has_helper_fn:
        return False, f"{helper_function}(bytea) is missing; run the encryption migration first"

    return True, None


def ensure_chat_search_function(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(ADVISORY_LOCK_SQL, {"lock_key": CHAT_MESSAGE_SEARCH_LOCK_KEY})
        conn.execute(CHAT_MESSAGE_SEARCH_FUNCTION_STATEMENT)


def ensure_note_search_function(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(ADVISORY_LOCK_SQL, {"lock_key": NOTE_SEARCH_LOCK_KEY})
        conn.execute(NOTE_SEARCH_FUNCTION_STATEMENT)


def ensure_chat_attribute_value_search_function(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(ADVISORY_LOCK_SQL, {"lock_key": CHAT_ATTRIBUTE_VALUE_SEARCH_LOCK_KEY})
        conn.execute(CHAT_ATTRIBUTE_VALUE_SEARCH_FUNCTION_STATEMENT)


def _index_exists(conn: Connection, schema: str, index_name: str) -> bool:
    """True only for a VALID index — an INVALID leftover from an interrupted
    CONCURRENTLY build must not count as 'already created'."""
    exists_query = text(
        """
        SELECT EXISTS (
            SELECT 1
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_index i ON i.indexrelid = c.oid
            WHERE n.nspname = :schema AND c.relname = :index_name AND i.indisvalid
        )
        """
    )
    return bool(conn.execute(exists_query, {"schema": schema, "index_name": index_name}).scalar())


def _count_searchable_rows(conn: Connection, schema: str, spec: SearchIndexSpec) -> int:
    count_query = text(
        f"""
        SELECT COUNT(*)
        FROM "{schema}"."{spec.table}"
        WHERE {spec.where_clause}
        """
    )
    return int(conn.execute(count_query).scalar() or 0)


def _drop_search_index(conn: Connection, schema: str, index_name: str) -> None:
    # CONCURRENTLY so the drop never blocks table reads/writes; the caller runs on
    # an AUTOCOMMIT connection because CONCURRENTLY cannot run inside a transaction.
    conn.execute(text(f'DROP INDEX CONCURRENTLY IF EXISTS "{schema}"."{index_name}"'))


def _manage_search_index(
    *,
    engine: Engine,
    org_id: str,
    schema: str,
    spec: SearchIndexSpec,
    encryption_service: EncryptionService | None,
    dry_run: bool,
    mode: str,
) -> SearchIndexResult:
    if mode not in SEARCH_INDEX_MODES:
        raise ValueError(f"Unsupported search index mode: {mode}")

    if not table_exists(engine, schema, spec.table):
        return SearchIndexResult(
            schema=schema,
            index_name=spec.index_name,
            encrypted_row_count=0,
            created=False,
            already_exists=False,
            action=mode,
            table=spec.table,
        )

    # CREATE/DROP INDEX CONCURRENTLY cannot run inside a transaction block, so the
    # whole operation runs on an AUTOCOMMIT connection. The read-only checks below
    # are unaffected by the lack of an enclosing transaction.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        exists_before = _index_exists(conn, schema, spec.index_name)

        if mode == SEARCH_INDEX_MODE_DROP:
            if dry_run or not exists_before:
                return SearchIndexResult(
                    schema=schema,
                    index_name=spec.index_name,
                    encrypted_row_count=0,
                    created=False,
                    already_exists=exists_before,
                    action=mode,
                    table=spec.table,
                )

            _drop_search_index(conn, schema, spec.index_name)
            logger.info("Removed %s search index for tenant schema %s", spec.table, schema)
            return SearchIndexResult(
                schema=schema,
                index_name=spec.index_name,
                encrypted_row_count=0,
                created=False,
                already_exists=True,
                removed=True,
                action=mode,
                table=spec.table,
            )

        prerequisites_ok, prerequisites_error = _has_search_prerequisites(conn, spec.helper_function)
        if not prerequisites_ok:
            return SearchIndexResult(
                schema=schema,
                index_name=spec.index_name,
                encrypted_row_count=0,
                created=False,
                already_exists=False,
                action=mode,
                error=prerequisites_error,
                table=spec.table,
            )

        searchable_rows = _count_searchable_rows(conn, schema, spec)

        if dry_run:
            return SearchIndexResult(
                schema=schema,
                index_name=spec.index_name,
                encrypted_row_count=searchable_rows,
                created=False,
                already_exists=exists_before,
                action=mode,
                table=spec.table,
            )

        if mode == SEARCH_INDEX_MODE_CREATE and exists_before:
            return SearchIndexResult(
                schema=schema,
                index_name=spec.index_name,
                encrypted_row_count=searchable_rows,
                created=False,
                already_exists=True,
                action=mode,
                table=spec.table,
            )

        if mode == SEARCH_INDEX_MODE_REPLACE and exists_before:
            _drop_search_index(conn, schema, spec.index_name)

        create_index_sql = text(
            f"""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS "{spec.index_name}"
            ON "{schema}"."{spec.table}"
            USING gin (({spec.helper_function}("{spec.content_column}")) public.gin_bigm_ops)
            WHERE {spec.where_clause}
            """
        )

        if spec.needs_org_key and encryption_service is None:
            return SearchIndexResult(
                schema=schema,
                index_name=spec.index_name,
                encrypted_row_count=searchable_rows,
                created=False,
                already_exists=exists_before,
                action=mode,
                error="EncryptionService is required to manage encrypted search indexes",
                table=spec.table,
            )

        if spec.needs_org_key:
            organization_key = encryption_service.derive_org_key(org_id)
            conn.execute(SET_ORG_KEY_SESSION_SQL, {"organization_key": organization_key})

        # A failed prior CONCURRENTLY build can leave an INVALID same-named index
        # that CREATE INDEX ... IF NOT EXISTS would skip — clear it first.
        drop_index_if_invalid(conn, schema, spec.index_name)
        conn.execute(create_index_sql)

    logger.info(
        "%s %s search index for tenant schema %s",
        "Replaced" if mode == SEARCH_INDEX_MODE_REPLACE and exists_before else "Created",
        spec.table,
        schema,
    )
    return SearchIndexResult(
        schema=schema,
        index_name=spec.index_name,
        encrypted_row_count=searchable_rows,
        created=True,
        already_exists=exists_before,
        action=mode,
        table=spec.table,
    )


def manage_chat_message_search_index(
    *,
    engine: Engine,
    org_id: str,
    schema: str,
    encryption_service: EncryptionService | None,
    dry_run: bool,
    mode: str = SEARCH_INDEX_MODE_CREATE,
) -> SearchIndexResult:
    return _manage_search_index(
        engine=engine,
        org_id=org_id,
        schema=schema,
        spec=CHAT_MESSAGE_SEARCH_SPEC,
        encryption_service=encryption_service,
        dry_run=dry_run,
        mode=mode,
    )


def manage_note_search_index(
    *,
    engine: Engine,
    org_id: str,
    schema: str,
    encryption_service: EncryptionService | None,
    dry_run: bool,
    mode: str = SEARCH_INDEX_MODE_CREATE,
) -> SearchIndexResult:
    return _manage_search_index(
        engine=engine,
        org_id=org_id,
        schema=schema,
        spec=NOTE_SEARCH_SPEC,
        encryption_service=encryption_service,
        dry_run=dry_run,
        mode=mode,
    )


def manage_chat_attribute_value_search_index(
    *,
    engine: Engine,
    org_id: str,
    schema: str,
    encryption_service: EncryptionService | None,
    dry_run: bool,
    mode: str = SEARCH_INDEX_MODE_CREATE,
) -> SearchIndexResult:
    return _manage_search_index(
        engine=engine,
        org_id=org_id,
        schema=schema,
        spec=CHAT_ATTRIBUTE_VALUE_SEARCH_SPEC,
        encryption_service=encryption_service,
        dry_run=dry_run,
        mode=mode,
    )


def create_chat_message_search_index(
    *,
    engine: Engine,
    org_id: str,
    schema: str,
    encryption_service: EncryptionService,
    dry_run: bool,
) -> SearchIndexResult:
    return manage_chat_message_search_index(
        engine=engine,
        org_id=org_id,
        schema=schema,
        encryption_service=encryption_service,
        dry_run=dry_run,
        mode=SEARCH_INDEX_MODE_CREATE,
    )
