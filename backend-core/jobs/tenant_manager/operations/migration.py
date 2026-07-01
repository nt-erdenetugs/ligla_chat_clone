from __future__ import annotations

import logging

from sqlalchemy import Connection, MetaData, Table, text
from sqlalchemy.engine import Engine

from app.db.tenant_migration_config import (
    COLUMN_REMAP,
    END_USER_TABLE,
    MEMBER_FEED_TABLE,
    ORG_ID_COLS,
    ORG_NAME_COL,
    TABLE_EXCLUDE_COLS,
    TENANT_TABLES,
    TableSpec,
)
from jobs.tenant_manager.operations.introspection import (
    get_column_types,
    get_columns,
    get_enum_columns,
    get_exact_table_name,
    table_exists,
)
from jobs.tenant_manager.operations.where_builder import build_where_clause

logger = logging.getLogger(__name__)


def create_memberfeeddata_table(engine: Engine, schema: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                f"""
            CREATE TABLE IF NOT EXISTS "{schema}"."memberFeedData" (
                "id" UUID NOT NULL DEFAULT gen_random_uuid(),
                "clientUserId" VARCHAR(255) NOT NULL,
                "lineUserId" VARCHAR(255),
                category1 VARCHAR(255), category2 VARCHAR(255), category3 VARCHAR(255),
                category4 VARCHAR(255), category5 VARCHAR(255), category6 VARCHAR(255),
                category7 VARCHAR(255), category8 VARCHAR(255), category9 VARCHAR(255),
                category10 VARCHAR(255), category11 VARCHAR(255), category12 VARCHAR(255),
                category13 VARCHAR(255), category14 VARCHAR(255), category15 VARCHAR(255),
                category16 VARCHAR(255), category17 VARCHAR(255), category18 VARCHAR(255),
                category19 VARCHAR(255), category20 VARCHAR(255), category21 VARCHAR(255),
                category22 VARCHAR(255), category23 VARCHAR(255), category24 VARCHAR(255),
                category25 VARCHAR(255),
                number1 INTEGER, number2 INTEGER, number3 INTEGER, number4 INTEGER, number5 INTEGER,
                number6 INTEGER, number7 INTEGER, number8 INTEGER, number9 INTEGER, number10 INTEGER,
                number11 INTEGER, number12 INTEGER, number13 INTEGER, number14 INTEGER, number15 INTEGER,
                datetime1 TIMESTAMP WITH TIME ZONE, datetime2 TIMESTAMP WITH TIME ZONE, datetime3 TIMESTAMP WITH TIME ZONE,
                datetime4 TIMESTAMP WITH TIME ZONE, datetime5 TIMESTAMP WITH TIME ZONE, datetime6 TIMESTAMP WITH TIME ZONE,
                datetime7 TIMESTAMP WITH TIME ZONE, datetime8 TIMESTAMP WITH TIME ZONE, datetime9 TIMESTAMP WITH TIME ZONE,
                datetime10 TIMESTAMP WITH TIME ZONE, datetime11 TIMESTAMP WITH TIME ZONE, datetime12 TIMESTAMP WITH TIME ZONE,
                datetime13 TIMESTAMP WITH TIME ZONE, datetime14 TIMESTAMP WITH TIME ZONE, datetime15 TIMESTAMP WITH TIME ZONE,
                "importedAt" TIMESTAMP WITH TIME ZONE,
                "syncedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE,
                PRIMARY KEY ("id")
            )
        """
            )
        )
        conn.execute(
            text(
                f"""
            CREATE INDEX IF NOT EXISTS "ix_memberFeedData_client_user" ON "{schema}"."memberFeedData"("clientUserId")
        """
            )
        )


def copy_enduser_with_union(
    *,
    engine: Engine,
    org_name: str,
    source_schema: str,
    target_schema: str,
    dry_run: bool,
) -> int:
    target_table_name = get_exact_table_name(engine, target_schema, END_USER_TABLE)
    if not target_table_name:
        logger.warning("  ! Warning: Target table %s.%s not found.", target_schema, END_USER_TABLE)
        return 0

    source_table_name = get_exact_table_name(engine, source_schema, END_USER_TABLE)
    if not source_table_name:
        logger.warning("  ! Warning: Source table %s.%s not found.", source_schema, END_USER_TABLE)
        return 0

    count_query = text(
        f"""
        SELECT COUNT(DISTINCT eu."userId")
        FROM "{source_schema}"."{source_table_name}" eu
        WHERE eu."userId" IN (
            SELECT DISTINCT c."endUserId"
            FROM "{source_schema}".chat c
            WHERE c."{ORG_NAME_COL}" = :org_name
              AND c."endUserId" IS NOT NULL

            UNION

            SELECT DISTINCT sd."endUserId"
            FROM "{source_schema}"."surveyData" sd
            WHERE sd."{ORG_NAME_COL}" = :org_name
              AND sd."endUserId" IS NOT NULL
        )
    """
    )

    insert_query = text(
        f"""
        INSERT INTO "{target_schema}"."{target_table_name}"
        ("userId", "displayName", "pictureUrl", "createdAt", "updatedAt")
        SELECT DISTINCT eu."userId", eu."displayName", eu."pictureUrl",
                        eu."createdAt", eu."updatedAt"
        FROM "{source_schema}"."{source_table_name}" eu
        WHERE eu."userId" IN (
            SELECT DISTINCT c."endUserId"
            FROM "{source_schema}".chat c
            WHERE c."{ORG_NAME_COL}" = :org_name
              AND c."endUserId" IS NOT NULL

            UNION

            SELECT DISTINCT sd."endUserId"
            FROM "{source_schema}"."surveyData" sd
            WHERE sd."{ORG_NAME_COL}" = :org_name
              AND sd."endUserId" IS NOT NULL
        )
    """
    )

    with engine.begin() as conn:
        if dry_run:
            count = conn.execute(count_query, {"org_name": org_name}).scalar()
            return int(count or 0)

        conn.execute(text(f'DELETE FROM "{target_schema}"."{target_table_name}"'))
        result = conn.execute(insert_query, {"org_name": org_name})
        return int(result.rowcount or 0)


def copy_table_to_tenant(
    *,
    engine: Engine,
    org_name: str,
    org_id: str,
    source_schema: str,
    target_schema: str,
    table_spec: TableSpec,
    dry_run: bool,
) -> int:
    if table_spec.name == END_USER_TABLE:
        return copy_enduser_with_union(
            engine=engine,
            org_name=org_name,
            source_schema=source_schema,
            target_schema=target_schema,
            dry_run=dry_run,
        )

    if table_spec.name == MEMBER_FEED_TABLE:
        if not table_exists(engine, target_schema, table_spec.name):
            logger.info("  Creating %s table with schema-per-tenant structure...", table_spec.name)
            create_memberfeeddata_table(engine, target_schema)
            logger.info("  Created %s in %s", table_spec.name, target_schema)

    metadata = MetaData()
    source_table_name = get_exact_table_name(engine, source_schema, table_spec.name)
    if not source_table_name:
        logger.warning("  ! Warning: Source table %s.%s not found.", source_schema, table_spec.name)
        return 0

    target_table_name = get_exact_table_name(engine, target_schema, table_spec.name)
    if not target_table_name:
        logger.warning("  ! Warning: Target table %s.%s not found.", target_schema, table_spec.name)
        return 0

    try:
        source_table = Table(source_table_name, metadata, schema=source_schema, autoload_with=engine)
        target_table = Table(target_table_name, metadata, schema=target_schema, autoload_with=engine)
    except Exception as e:
        logger.error("  ! Error reflecting tables for %s: %s", table_spec.name, e)
        return 0

    exclude_cols = tuple(sorted(TABLE_EXCLUDE_COLS.get(table_spec.name, set())))
    try:
        from_clause, where_clause, params = build_where_clause(
            table_spec, source_table_name, source_schema, org_name, org_id, engine
        )
    except ValueError as e:
        logger.warning("  ! Warning: %s. Skipping %s.", e, table_spec.name)
        return 0

    source_enums = get_enum_columns(engine, source_schema, source_table_name)
    target_enums = get_enum_columns(engine, target_schema, target_table_name)
    target_cols: list[str] = []
    select_exprs: list[str] = []

    for target_col in target_table.columns:
        if target_col.name in exclude_cols:
            continue

        source_col_name = COLUMN_REMAP.get(table_spec.name, {}).get(target_col.name) or target_col.name

        if target_col.name in ORG_ID_COLS:
            target_cols.append(f'"{target_col.name}"')
            select_exprs.append(f"CAST('{org_id}' AS UUID)")
        elif target_col.name == ORG_NAME_COL:
            continue
        elif source_col_name == "__gen_random_uuid__":
            target_cols.append(f'"{target_col.name}"')
            select_exprs.append("gen_random_uuid()")
        elif source_col_name in source_table.columns:
            target_cols.append(f'"{target_col.name}"')

            source_enum_type = source_enums.get(source_col_name)
            target_enum_type = target_enums.get(target_col.name)

            if source_enum_type and target_enum_type:
                select_exprs.append(
                    f'{source_schema}."{source_table_name}"."{source_col_name}"::text::"{target_schema}"."{target_enum_type}"'
                )
            else:
                select_exprs.append(f'{source_schema}."{source_table_name}"."{source_col_name}"')

    if not target_cols:
        logger.warning("  ! Warning: No compatible columns found for %s. Skipping.", table_spec.name)
        return 0

    count_sql = text(
        f"""
        SELECT COUNT(*) FROM {from_clause}
        WHERE {where_clause}
    """
    )

    insert_sql = text(
        f"""
        INSERT INTO "{target_schema}"."{target_table_name}" ({", ".join(target_cols)})
        SELECT {", ".join(select_exprs)}
        FROM {from_clause}
        WHERE {where_clause}
    """
    )

    with engine.begin() as conn:
        if dry_run:
            return int(conn.execute(count_sql, params).scalar() or 0)
        conn.execute(text(f'DELETE FROM "{target_schema}"."{target_table_name}"'))
        result = conn.execute(insert_sql, params)
        return int(result.rowcount or 0)


def count_rows(engine: Engine, schema: str, table: str, org_column: str | None, org_name: str | None) -> int:
    where = ""
    params: dict[str, str] = {}

    if org_column and org_name is not None:
        cols = get_columns(engine, schema, table, exclude_cols=())
        if org_column in cols:
            where = f'WHERE "{org_column}" = :org'
            params["org"] = org_name

    sql = text(f'SELECT COUNT(*) FROM "{schema}"."{table}" {where}')

    with engine.connect() as conn:
        return int(conn.execute(sql, params).scalar() or 0)


def count_rows_for_tablespec(
    *,
    engine: Engine,
    schema: str,
    table_spec: TableSpec,
    org_name: str,
    org_id: str,
    conn: Connection | None = None,
) -> int:
    table_name = get_exact_table_name(engine, schema, table_spec.name)
    if not table_name:
        return 0

    from_clause, where_clause, params = build_where_clause(
        table_spec,
        table_name,
        schema,
        org_name,
        org_id,
        engine,
    )
    sql = text(f"SELECT COUNT(*) FROM {from_clause} WHERE {where_clause}")
    if conn is not None:
        return int(conn.execute(sql, params).scalar() or 0)
    with engine.connect() as c:
        return int(c.execute(sql, params).scalar() or 0)


def build_select_exprs_for_rollback(
    *, engine: Engine, tenant_schema: str, public_schema: str, table: str, cols: list[str]
) -> list[str]:
    tenant_types = get_column_types(engine, tenant_schema, table, cols)
    public_types = get_column_types(engine, public_schema, table, cols)

    exprs: list[str] = []
    for c in cols:
        pub_dt, pub_udt = public_types.get(c, (None, None))
        ten_dt, _ten_udt = tenant_types.get(c, (None, None))

        if pub_dt == "USER-DEFINED" and pub_udt:
            exprs.append(f'"{c}"::text::"{public_schema}"."{pub_udt}"')
            continue

        _ = ten_dt
        exprs.append(f'"{c}"')

    return exprs


def build_delete_query_for_target(
    *,
    engine: Engine,
    org_name: str,
    org_id: str,
    target_schema: str,
    table_spec: TableSpec,
) -> tuple[str, dict[str, str]]:
    """Build DELETE query to remove an org's rows from target schema (public_old).

    Uses subquery approach: DELETE ... WHERE ctid IN (SELECT ctid FROM ... JOIN ... WHERE ...)
    This handles tables that need JOINs to identify org ownership.
    """
    table_name = get_exact_table_name(engine, target_schema, table_spec.name)
    if not table_name:
        return "", {}

    from_clause, where_clause, params = build_where_clause(
        table_spec, table_name, target_schema, org_name, org_id, engine
    )

    # For tables with direct org_column (no JOIN needed), simple DELETE WHERE
    if table_spec.join_parent is None:
        return (
            f'DELETE FROM "{target_schema}"."{table_name}" WHERE {where_clause}',
            params,
        )

    # For join-based tables, use subquery with ctid to avoid JOIN-in-DELETE syntax issues
    return (
        f'DELETE FROM "{target_schema}"."{table_name}" '
        f"WHERE ctid IN ("
        f'SELECT "{target_schema}"."{table_name}".ctid FROM {from_clause} WHERE {where_clause}'
        f")",
        params,
    )


def delete_org_rows_from_target(
    *,
    conn: Connection,
    engine: Engine,
    org_name: str,
    org_id: str,
    target_schema: str,
    table_spec: TableSpec,
) -> int:
    """Delete an org's existing rows from target schema before rollback insert."""
    if not table_exists(engine, target_schema, table_spec.name):
        return 0

    # endUser is handled separately by delete_enduser_from_target()
    if table_spec.name == "endUser":
        return 0

    if table_spec.org_column == "" and table_spec.join_parent is None:
        raise RuntimeError(
            f"Cannot delete from {table_spec.name}: no org filtering available (org_column='' and no join_parent). "
            f"This would delete ALL rows."
        )

    delete_sql, params = build_delete_query_for_target(
        engine=engine,
        org_name=org_name,
        org_id=org_id,
        target_schema=target_schema,
        table_spec=table_spec,
    )

    if not delete_sql:
        return 0

    result = conn.execute(text(delete_sql), params)
    return int(result.rowcount or 0)


def delete_enduser_from_target(
    *,
    conn: Connection,
    engine: Engine,
    source_schema: str,
    target_schema: str,
) -> int:
    """No-op: endUser is globally shared across orgs — the same userId can be
    referenced by chats from multiple organizations. Deleting per-org causes FK
    violations from other orgs' chat rows still in public_old.
    endUser uses ON CONFLICT upsert during the insert phase instead.
    """
    return 0


def copy_table_from_tenant(
    *,
    conn: Connection,
    engine: Engine,
    org_name: str,
    source_schema: str,
    target_schema: str,
    table_spec: TableSpec,
) -> tuple[int, int]:
    """Copy all rows from a tenant schema table into the target (public_old).

    Assumes the org's stale rows have already been deleted from target.
    Uses plain INSERT (no ON CONFLICT) since pre-delete ensures no conflicts.
    """
    tenant_count = count_rows(engine, source_schema, table_spec.name, None, None)

    if not table_exists(engine, target_schema, table_spec.name):
        raise RuntimeError(f"{target_schema}.{table_spec.name} does not exist")

    exclude_cols = tuple(sorted(TABLE_EXCLUDE_COLS.get(table_spec.name, set())))

    tenant_all_cols = get_columns(engine, source_schema, table_spec.name, exclude_cols=())
    target_all_cols = get_columns(engine, target_schema, table_spec.name, exclude_cols=())

    tenant_cols = [c for c in tenant_all_cols if c not in exclude_cols]
    target_cols = [c for c in target_all_cols if c not in exclude_cols]

    cols = [c for c in tenant_cols if c in target_cols]

    inject_org_value = table_spec.org_column in target_all_cols and table_spec.org_column not in tenant_all_cols
    if inject_org_value and table_spec.org_column not in cols:
        cols.append(table_spec.org_column)

    if table_spec.name == "memberFeedData" and "id" in cols:
        tenant_types = get_column_types(engine, source_schema, table_spec.name, ["id"])
        target_types = get_column_types(engine, target_schema, table_spec.name, ["id"])
        tenant_id_type = tenant_types.get("id")
        target_id_type = target_types.get("id")
        if tenant_id_type != target_id_type:
            cols = [c for c in cols if c != "id"]

    if not cols:
        raise RuntimeError(
            f"No compatible columns for tenant={source_schema}.{table_spec.name} -> {target_schema}.{table_spec.name}"
        )

    cols_sql = ", ".join(f'"{c}"' for c in cols)

    select_exprs = build_select_exprs_for_rollback(
        engine=engine,
        tenant_schema=source_schema,
        public_schema=target_schema,
        table=table_spec.name,
        cols=cols,
    )

    if inject_org_value:
        for i, c in enumerate(cols):
            if c == table_spec.org_column:
                select_exprs[i] = ":org"
                break

    select_sql = ", ".join(select_exprs)

    # endUser is globally shared across orgs — use upsert to merge without pre-delete
    if table_spec.name == "endUser":
        update_cols = [c for c in cols if c != "userId"]
        if update_cols:
            set_sql = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in update_cols)
            on_conflict = f'ON CONFLICT ("userId") DO UPDATE SET {set_sql}'
        else:
            on_conflict = 'ON CONFLICT ("userId") DO NOTHING'

        sql = text(
            f"""
            INSERT INTO "{target_schema}"."{table_spec.name}" ({cols_sql})
            SELECT {select_sql}
            FROM "{source_schema}"."{table_spec.name}"
            {on_conflict}
        """
        )
    else:
        sql = text(
            f"""
            INSERT INTO "{target_schema}"."{table_spec.name}" ({cols_sql})
            SELECT {select_sql}
            FROM "{source_schema}"."{table_spec.name}"
        """
        )

    params = {"org": org_name} if inject_org_value else {}
    res = conn.execute(sql, params)
    return tenant_count, int(res.rowcount or 0)


def ensure_organization_in_target(conn: Connection, engine: Engine, org_name: str, target_schema: str) -> None:
    if not table_exists(engine, target_schema, "organization"):
        logger.warning("  - organization: SKIP (missing in target schema %s)", target_schema)
        return

    if not table_exists(engine, "public", "organization"):
        logger.warning("  - organization: SKIP (missing in public schema)")
        return

    source_cols = get_columns(engine, "public", "organization", exclude_cols=())
    target_cols = get_columns(engine, target_schema, "organization", exclude_cols=())

    cols = [c for c in source_cols if c in target_cols]
    if not cols:
        logger.warning("  - organization: SKIP (no compatible columns)")
        return

    if "name" not in cols:
        logger.warning("  - organization: SKIP (missing 'name' column)")
        return

    cols_sql = ", ".join(f'"{c}"' for c in cols)

    target_types = get_column_types(engine, target_schema, "auth", cols)

    select_exprs: list[str] = []
    for c in cols:
        tgt_dt, tgt_udt = target_types.get(c, (None, None))
        if tgt_dt == "USER-DEFINED" and tgt_udt:
            select_exprs.append(f'"{c}"::text::"{target_schema}"."{tgt_udt}"')
        else:
            select_exprs.append(f'"{c}"')

    select_sql = ", ".join(select_exprs)
    update_cols = [c for c in cols if c != "name"]

    if update_cols:
        update_exprs = []
        for c in update_cols:
            tgt_dt, tgt_udt = target_types.get(c, (None, None))
            if tgt_dt == "USER-DEFINED" and tgt_udt:
                update_exprs.append(f'"{c}" = EXCLUDED."{c}"::text::"{target_schema}"."{tgt_udt}"')
            else:
                update_exprs.append(f'"{c}" = EXCLUDED."{c}"')
        update_sql = ", ".join(update_exprs)
        on_conflict = f'ON CONFLICT ("name") DO UPDATE SET {update_sql}'
    else:
        on_conflict = 'ON CONFLICT ("name") DO NOTHING'

    sql = text(
        f"""
        INSERT INTO "{target_schema}"."organization" ({cols_sql})
        SELECT {select_sql}
        FROM public."organization"
        WHERE "name" = :org_name
        {on_conflict}
    """
    )

    conn.execute(sql, {"org_name": org_name})


def ensure_auth_in_target(conn: Connection, engine: Engine, source_schema: str, target_schema: str) -> None:
    if not table_exists(engine, target_schema, "auth"):
        logger.warning("  - auth: SKIP (missing in target schema %s)", target_schema)
        return

    if not table_exists(engine, "public", "auth"):
        logger.warning("  - auth: SKIP (missing in public schema)")
        return

    if not table_exists(engine, source_schema, "user"):
        logger.warning("  - auth: SKIP (missing in tenant schema %s.user)", source_schema)
        return

    source_cols = get_columns(engine, "public", "auth", exclude_cols=())
    target_cols = get_columns(engine, target_schema, "auth", exclude_cols=())

    cols = [c for c in source_cols if c in target_cols]
    if not cols:
        logger.warning("  - auth: SKIP (no compatible columns)")
        return

    if "id" not in cols:
        logger.warning("  - auth: SKIP (missing 'id' column)")
        return

    cols_sql = ", ".join(f'"{c}"' for c in cols)

    target_types = get_column_types(engine, target_schema, "auth", cols)

    select_exprs: list[str] = []
    for c in cols:
        tgt_dt, tgt_udt = target_types.get(c, (None, None))
        if tgt_dt == "USER-DEFINED" and tgt_udt:
            select_exprs.append(f'"{c}"::text::"{target_schema}"."{tgt_udt}"')
        else:
            select_exprs.append(f'"{c}"')

    select_sql = ", ".join(select_exprs)

    # Resolve stale cross-org email collisions in target auth table safely.
    # Only delete orphan auth rows (no matching target user row) to avoid
    # breaking FK references from target.user.
    orphan_conflict_ids: list[str] = []

    if table_exists(engine, target_schema, "user"):
        orphan_conflict_ids_sql = text(
            f"""
            SELECT t."id"
            FROM "{target_schema}"."auth" t
            WHERE t."email" IN (
                SELECT p."email"
                FROM public."auth" p
                WHERE p."id" IN (SELECT "id" FROM "{source_schema}"."user")
            )
            AND t."id" NOT IN (SELECT "id" FROM "{source_schema}"."user")
            AND NOT EXISTS (
                SELECT 1
                FROM "{target_schema}"."user" u
                WHERE u."id" = t."id"
            )
        """
        )
        orphan_conflict_ids = [row[0] for row in conn.execute(orphan_conflict_ids_sql).fetchall()]

        if orphan_conflict_ids:
            logger.info("  - auth: resolving %s orphan email conflict(s)", len(orphan_conflict_ids))

            if table_exists(engine, target_schema, "userPasswordResetToken"):
                delete_reset_tokens_sql = text(
                    f"""
                    DELETE FROM "{target_schema}"."userPasswordResetToken"
                    WHERE "userId" = ANY(:ids)
                """
                )
                conn.execute(delete_reset_tokens_sql, {"ids": orphan_conflict_ids})

            delete_orphan_auth_sql = text(
                f"""
                DELETE FROM "{target_schema}"."auth"
                WHERE "id" = ANY(:ids)
            """
            )
            conn.execute(delete_orphan_auth_sql, {"ids": orphan_conflict_ids})
    else:
        logger.warning('  - auth: skipping orphan email conflict resolution (missing "%s".user table)', target_schema)

    update_cols = [c for c in cols if c != "id"]
    if update_cols:
        update_exprs = []
        for c in update_cols:
            tgt_dt, tgt_udt = target_types.get(c, (None, None))
            if tgt_dt == "USER-DEFINED" and tgt_udt:
                update_exprs.append(f'"{c}" = EXCLUDED."{c}"::text::"{target_schema}"."{tgt_udt}"')
            else:
                update_exprs.append(f'"{c}" = EXCLUDED."{c}"')
        update_sql = ", ".join(update_exprs)
        on_conflict = f'ON CONFLICT ("id") DO UPDATE SET {update_sql}'
    else:
        on_conflict = 'ON CONFLICT ("id") DO NOTHING'

    sql = text(
        f"""
        INSERT INTO "{target_schema}"."auth" ({cols_sql})
        SELECT {select_sql}
        FROM public."auth"
        WHERE "id" IN (SELECT "id" FROM "{source_schema}"."user")
        {on_conflict}
    """
    )

    conn.execute(sql)


def sync_sequences(engine: Engine, schema_name: str, tables: list[str]) -> None:
    with engine.begin() as conn:
        for table in tables:
            res = conn.execute(
                text(
                    """
                    SELECT column_name, column_default
                    FROM information_schema.columns
                    WHERE table_schema = :schema AND table_name = :table
                    AND column_default LIKE 'nextval(%'
                """
                ),
                {"schema": schema_name, "table": table},
            )

            for row in res:
                col = row[0]
                seq_query = text("SELECT pg_get_serial_sequence(:tbl, :col)")
                seq_result = conn.execute(seq_query, {"tbl": f'"{schema_name}"."{table}"', "col": col}).scalar()
                if seq_result:
                    sql = f"""
                        SELECT setval(
                            '{seq_result}',
                            COALESCE((SELECT MAX("{col}") FROM "{schema_name}"."{table}"), 1),
                            true
                        )
                    """
                    conn.execute(text(sql))


def validate_fk_integrity(engine: Engine, schema: str) -> list[str]:
    errors: list[str] = []

    fk_checks = [
        ("chat", "endUserId", "endUser", "userId"),
        ("note", "chatId", "chat", "id"),
        ("chatMessage", "chatId", "chat", "id"),
        ("chatUserRead", "chatId", "chat", "id"),
        ("chatActivity", "chatId", "chat", "id"),
        ("chatTeamAssignment", "chatId", "chat", "id"),
        ("chatTags", "chatId", "chat", "id"),
        ("chatAttributeValue", "chatId", "chat", "id"),
        ("surveyData", "endUserId", "endUser", "userId"),
    ]

    with engine.connect() as conn:
        for table, fk_col, ref_table, ref_col in fk_checks:
            if not table_exists(engine, schema, table) or not table_exists(engine, schema, ref_table):
                continue

            orphan_query = text(
                f"""
                SELECT COUNT(*) FROM "{schema}"."{table}" t
                LEFT JOIN "{schema}"."{ref_table}" r ON t."{fk_col}" = r."{ref_col}"
                WHERE r."{ref_col}" IS NULL AND t."{fk_col}" IS NOT NULL
            """
            )
            orphan_count = conn.execute(orphan_query).scalar() or 0

            if orphan_count > 0:
                errors.append(f"{table}.{fk_col} has {orphan_count} orphan references to {ref_table}.{ref_col}")

    return errors


def migrate_org_to_tenant(
    *,
    engine: Engine,
    org_name: str,
    org_id: str,
    source_schema: str,
    target_schema: str,
    dry_run: bool = True,
) -> dict[str, int]:
    results: dict[str, int] = {}
    tables_migrated: list[str] = []

    for ts in TENANT_TABLES:
        try:
            count = copy_table_to_tenant(
                engine=engine,
                org_name=org_name,
                org_id=org_id,
                source_schema=source_schema,
                target_schema=target_schema,
                table_spec=ts,
                dry_run=dry_run,
            )
            results[ts.name] = count
            if count > 0 and not dry_run:
                tables_migrated.append(ts.name)
        except Exception as e:
            logger.error("  ! Error migrating %s: %s", ts.name, e)
            results[ts.name] = -1

    if not dry_run and tables_migrated:
        sync_sequences(engine, target_schema, tables_migrated)

    if not dry_run:
        fk_errors = validate_fk_integrity(engine, target_schema)
        if fk_errors:
            logger.warning("  FK integrity warnings:")
            for err in fk_errors:
                logger.warning("    - %s", err)

    return results


def validate_tenant_tables_config(engine: Engine, source_schema: str) -> None:
    errors: list[str] = []
    warnings: list[str] = []

    for ts in TENANT_TABLES:
        if ts.join_parent:
            parent_table = ts.join_parent[0]
            parent_spec = next((t for t in TENANT_TABLES if t.name == parent_table), None)
            if parent_spec is None:
                errors.append(
                    f"{ts.name}: Parent table '{parent_table}' not found in TENANT_TABLES. "
                    f"Add it to TENANT_TABLES or fix join_parent configuration."
                )

        table_name = get_exact_table_name(engine, source_schema, ts.name)
        if not table_name:
            warnings.append(f"{ts.name}: Table not found in source schema '{source_schema}' (will be skipped)")
            continue

        try:
            cols = get_columns(engine, source_schema, table_name, ())

            if ts.join_parent and not ts.reverse_join:
                fk_col = ts.join_parent[1]
                if fk_col not in cols:
                    errors.append(f"{ts.name}: FK column '{fk_col}' does not exist in source table")

            if ts.join_parent and ts.join_child_column and ts.join_child_column not in cols:
                if ts.join_child_column != "id":
                    warnings.append(
                        f"{ts.name}: join_child_column '{ts.join_child_column}' not found in table. "
                        f"This may cause issues if reverse_join is used."
                    )

            if not ts.join_parent and ts.org_column and ts.org_column not in ("", *ORG_ID_COLS):
                if ts.org_column not in cols:
                    errors.append(f"{ts.name}: org_column '{ts.org_column}' does not exist in source table")

        except Exception as e:
            warnings.append(f"{ts.name}: Could not validate columns: {e}")

    if warnings:
        logger.warning("Configuration Warnings:")
        for warning in warnings:
            logger.warning("  - %s", warning)

    if errors:
        logger.error("Configuration Errors:")
        for error in errors:
            logger.error("  - %s", error)
        raise ValueError(
            f"TENANT_TABLES configuration has {len(errors)} error(s). Fix these issues before running migration."
        )

    if not warnings and not errors:
        logger.info("TENANT_TABLES configuration validated successfully")
