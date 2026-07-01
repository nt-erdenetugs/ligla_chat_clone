from __future__ import annotations

import logging

from sqlalchemy import Connection, text
from sqlalchemy.engine import Engine

from app.db.tenant_migration_config import (
    END_USER_TABLE,
    MEMBER_FEED_TABLE,
    TABLE_EXCLUDE_COLS,
    TENANT_TABLES,
    TableSpec,
)
from jobs.tenant_manager.operations.introspection import get_column_types, get_columns, table_exists
from jobs.tenant_manager.operations.migration import count_rows, count_rows_for_tablespec, ensure_auth_in_target
from jobs.tenant_manager.operations.where_builder import build_delete_query_for_target

logger = logging.getLogger(__name__)


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


def delete_org_rows_from_target(
    *,
    conn: Connection,
    engine: Engine,
    org_name: str,
    org_id: str,
    target_schema: str,
    table_spec: TableSpec,
) -> int:
    if not table_exists(engine, target_schema, table_spec.name):
        return 0

    if table_spec.name == END_USER_TABLE:
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

    if table_spec.name == MEMBER_FEED_TABLE and "id" in cols:
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

    if table_spec.name == END_USER_TABLE:
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

    target_types = get_column_types(engine, target_schema, "organization", cols)

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


def migrate_org_from_tenant(
    *,
    engine: Engine,
    org_name: str,
    org_id: str,
    source_schema: str,
    target_schema: str,
    dry_run: bool = True,
    strict_counts: bool = False,
) -> dict[str, tuple[int, int]]:
    results: dict[str, tuple[int, int]] = {}
    mismatches: list[str] = []

    if dry_run:
        for ts in TENANT_TABLES:
            if not table_exists(engine, source_schema, ts.name):
                continue
            tenant_count = count_rows(engine, source_schema, ts.name, None, None)
            results[ts.name] = (tenant_count, tenant_count)
        return results

    available_tables: list[TableSpec] = []
    for ts in TENANT_TABLES:
        if not table_exists(engine, source_schema, ts.name):
            logger.warning("  - %s: SKIP (missing in tenant schema %s)", ts.name, source_schema)
            continue
        if not table_exists(engine, target_schema, ts.name):
            logger.warning("  - %s: SKIP (missing in target schema %s)", ts.name, target_schema)
            continue
        available_tables.append(ts)

    with engine.begin() as conn:
        ensure_organization_in_target(conn, engine, org_name, target_schema)
        ensure_auth_in_target(conn, engine, source_schema, target_schema)

        logger.info("  Phase 1: Deleting org's stale data from %s...", target_schema)

        for ts in reversed(available_tables):
            try:
                if ts.name == END_USER_TABLE:
                    deleted = delete_enduser_from_target(
                        conn=conn,
                        engine=engine,
                        source_schema=source_schema,
                        target_schema=target_schema,
                    )
                else:
                    deleted = delete_org_rows_from_target(
                        conn=conn,
                        engine=engine,
                        org_name=org_name,
                        org_id=org_id,
                        target_schema=target_schema,
                        table_spec=ts,
                    )
                if deleted > 0:
                    logger.info("    deleted %s: %s rows", ts.name, deleted)
            except Exception as e:
                logger.error("  ! Error deleting %s from %s: %s", ts.name, target_schema, e)
                raise

        logger.info("  Phase 2: Inserting data from %s into %s...", source_schema, target_schema)

        for ts in available_tables:
            try:
                tenant_count, affected = copy_table_from_tenant(
                    conn=conn,
                    engine=engine,
                    org_name=org_name,
                    source_schema=source_schema,
                    target_schema=target_schema,
                    table_spec=ts,
                )
                results[ts.name] = (tenant_count, affected)
                logger.info("    %s: tenant=%s, inserted=%s", ts.name, tenant_count, affected)

                if strict_counts:
                    if ts.name == END_USER_TABLE:
                        continue
                    public_count_after = count_rows_for_tablespec(
                        engine=engine,
                        schema=target_schema,
                        table_spec=ts,
                        org_name=org_name,
                        org_id=org_id,
                        conn=conn,
                    )
                    if tenant_count != public_count_after:
                        mismatches.append(f"{ts.name}: tenant={tenant_count} public_after={public_count_after}")

            except Exception as e:
                logger.error("  ! Error migrating %s: %s", ts.name, e)
                raise

    if mismatches:
        raise RuntimeError(f"Strict count mismatches detected: {', '.join(mismatches)}")

    return results
