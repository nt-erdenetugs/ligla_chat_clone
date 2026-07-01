from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.common.utils import uuid_to_schema_name
from app.db.tenant_migration_config import END_USER_TABLE, ORG_NAME_COL, TABLE_EXCLUDE_COLS, TENANT_TABLES, TableSpec
from jobs.tenant_manager.operations.introspection import get_columns, get_exact_table_name, table_exists


@dataclass
class ValidationResult:
    table: str
    source_count: int
    tenant_count: int
    checksum_match: bool | None = None
    error: str | None = None

    @property
    def is_valid(self) -> bool:
        if self.error:
            return False
        if self.source_count != self.tenant_count:
            return False
        if self.checksum_match is not None and not self.checksum_match:
            return False
        return True


def find_table_spec(table_name: str) -> TableSpec | None:
    for ts in TENANT_TABLES:
        if ts.name == table_name:
            return ts
    return None


def build_count_query_for_source(
    ts: TableSpec, table_name: str, source_schema: str, engine: Engine
) -> tuple[str, dict[str, str]]:
    # Case 1: Tables with direct org_column
    if ts.join_parent is None:
        return (
            f'SELECT COUNT(*) FROM "{source_schema}"."{table_name}" WHERE "{ts.org_column}" = :org_name',
            {},
        )

    parent_table, fk_column, parent_org_column = ts.join_parent
    parent_table_name = get_exact_table_name(engine, source_schema, parent_table)
    if not parent_table_name:
        return "SELECT 0", {}

    # Build join condition for this table -> parent
    if ts.reverse_join:
        join_condition = (
            f'"{source_schema}"."{table_name}"."{ts.join_child_column}"'
            f' = "{source_schema}"."{parent_table_name}"."{fk_column}"'
        )
    else:
        join_condition = (
            f'"{source_schema}"."{table_name}"."{fk_column}"'
            f' = "{source_schema}"."{parent_table_name}"."{ts.join_child_column}"'
        )

    # Case 2: Parent has org_column directly
    if parent_org_column != "":
        return (
            f'SELECT COUNT(*) FROM "{source_schema}"."{table_name}" '
            f'INNER JOIN "{source_schema}"."{parent_table_name}" ON {join_condition} '
            f'WHERE "{source_schema}"."{parent_table_name}"."{parent_org_column}" = :org_name',
            {},
        )

    # Case 3: Cascade - traverse parent chain to find org filter
    join_chain: list[tuple[str, str]] = []  # [(table_name, join_condition)]
    join_chain.append((parent_table_name, join_condition))

    current_parent = parent_table
    current_parent_name = parent_table_name
    visited: set[str] = {ts.name, parent_table}

    while True:
        parent_spec = find_table_spec(current_parent)
        if parent_spec is None:
            return "SELECT 0", {}

        if parent_spec.join_parent is None:
            # Terminal: parent has direct org_column
            from_clause = f'"{source_schema}"."{table_name}"'
            for jt, jc in join_chain:
                from_clause += f' INNER JOIN "{source_schema}"."{jt}" ON {jc}'

            return (
                f"SELECT COUNT(*) FROM {from_clause} "
                f'WHERE "{source_schema}"."{current_parent_name}"."{parent_spec.org_column}" = :org_name',
                {},
            )

        # Continue up the chain
        gp_table, gp_fk, gp_org_col = parent_spec.join_parent
        if gp_table in visited:
            return "SELECT 0", {}  # Circular dependency
        visited.add(gp_table)

        gp_table_name = get_exact_table_name(engine, source_schema, gp_table)
        if not gp_table_name:
            return "SELECT 0", {}

        # Build join condition for parent -> grandparent
        if parent_spec.reverse_join:
            gp_join = (
                f'"{source_schema}"."{current_parent_name}"."{parent_spec.join_child_column}"'
                f' = "{source_schema}"."{gp_table_name}"."{gp_fk}"'
            )
        else:
            gp_join = (
                f'"{source_schema}"."{current_parent_name}"."{gp_fk}"'
                f' = "{source_schema}"."{gp_table_name}"."{parent_spec.join_child_column}"'
            )

        join_chain.append((gp_table_name, gp_join))

        if gp_org_col != "":
            # Found terminal with org_column
            from_clause = f'"{source_schema}"."{table_name}"'
            for jt, jc in join_chain:
                from_clause += f' INNER JOIN "{source_schema}"."{jt}" ON {jc}'

            return (
                f"SELECT COUNT(*) FROM {from_clause} "
                f'WHERE "{source_schema}"."{gp_table_name}"."{gp_org_col}" = :org_name',
                {},
            )

        current_parent = gp_table
        current_parent_name = gp_table_name


def count_source_rows(
    engine: Engine, org_name: str, table_spec: TableSpec, source_schema: str = "public_old"
) -> int | None:
    """
    Count rows in source schema for given organization.

    Returns None if table doesn't exist.
    """
    table_name = get_exact_table_name(engine, source_schema, table_spec.name)
    if not table_name:
        return None

    # Special handling for endUser - must match copy_enduser_with_union migration logic
    # EndUser can be referenced by both chat AND surveyData (chat can be deleted but surveyData persists)
    if table_spec.name == END_USER_TABLE:
        query = f"""
            SELECT COUNT(DISTINCT eu."userId")
            FROM "{source_schema}"."{table_name}" eu
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
        with engine.connect() as conn:
            return int(conn.execute(text(query), {"org_name": org_name}).scalar() or 0)

    query, _ = build_count_query_for_source(table_spec, table_name, source_schema, engine)

    with engine.connect() as conn:
        return int(conn.execute(text(query), {"org_name": org_name}).scalar() or 0)


def count_tenant_rows(engine: Engine, schema: str, table: str) -> int:
    with engine.connect() as conn:
        return int(conn.execute(text(f'SELECT COUNT(*) FROM "{schema}"."{table}"')).scalar() or 0)


def get_column_checksum(
    engine: Engine, schema: str, table: str, columns: list[str], org_filter: str | None = None
) -> str:
    cols_sql = " || ".join([f"COALESCE(\"{c}\"::text, '')" for c in columns])
    where_clause = 'WHERE "organizationName" = :org_filter' if org_filter else ""

    sql = f"""
        SELECT md5(string_agg(row_hash, '' ORDER BY row_hash))
        FROM (
            SELECT md5({cols_sql}) as row_hash
            FROM "{schema}"."{table}"
            {where_clause}
        ) sub
    """
    with engine.connect() as conn:
        params = {"org_filter": org_filter} if org_filter else {}
        return str(conn.execute(text(sql), params).scalar() or "")


def validate_org_table(
    engine: Engine,
    org_name: str,
    tenant_schema: str,
    table_spec: TableSpec,
    source_schema: str = "public_old",
    deep: bool = False,
) -> ValidationResult:
    try:
        source_count = count_source_rows(engine, org_name, table_spec, source_schema)
        if source_count is None:
            return ValidationResult(
                table=table_spec.name,
                source_count=0,
                tenant_count=0,
                error="Table does not exist in source schema",
            )

        if not table_exists(engine, tenant_schema, table_spec.name):
            return ValidationResult(
                table=table_spec.name,
                source_count=source_count,
                tenant_count=0,
                error="Table does not exist in tenant schema",
            )

        tenant_count = count_tenant_rows(engine, tenant_schema, table_spec.name)
        checksum_match = None
        if deep and source_count > 0 and source_count == tenant_count:
            if table_spec.join_parent is None:
                cols = get_columns(engine, tenant_schema, table_spec.name, exclude_cols=())
                if cols:
                    # Exclude organizationName and any explicitly excluded columns from checksum comparison
                    excluded_cols = TABLE_EXCLUDE_COLS.get(table_spec.name, set())
                    cols_for_checksum = [c for c in cols if c != ORG_NAME_COL and c not in excluded_cols]
                    source_checksum = get_column_checksum(
                        engine, source_schema, table_spec.name, cols_for_checksum, org_filter=org_name
                    )
                    tenant_checksum = get_column_checksum(engine, tenant_schema, table_spec.name, cols_for_checksum)
                    checksum_match = source_checksum == tenant_checksum

        return ValidationResult(
            table=table_spec.name,
            source_count=source_count,
            tenant_count=tenant_count,
            checksum_match=checksum_match,
        )

    except Exception as e:
        return ValidationResult(table=table_spec.name, source_count=0, tenant_count=0, error=f"{type(e).__name__}: {e}")


def validate_org(
    engine: Engine, org_name: str, tenant_schema: str, source_schema: str = "public_old", deep: bool = False
) -> dict[str, ValidationResult]:
    results: dict[str, ValidationResult] = {}

    for ts in TENANT_TABLES:
        result = validate_org_table(engine, org_name, tenant_schema, ts, source_schema=source_schema, deep=deep)
        results[ts.name] = result

    return results


def validate_all_tenants(
    engine: Engine, source_schema: str = "public_old", deep: bool = False
) -> dict[str, dict[str, ValidationResult]]:
    with engine.connect() as conn:
        res = conn.execute(text("SELECT id::text, name FROM public.organization")).fetchall()
        org_map = {}
        for row in res:
            org_id, name = row
            schema_name = uuid_to_schema_name(org_id)
            org_map[schema_name] = name

    with engine.connect() as conn:
        res = conn.execute(text("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'org_%'"))
        schemas = [row[0] for row in res]

    if not schemas:
        return {}

    results: dict[str, dict[str, ValidationResult]] = {}

    for schema in schemas:
        org_name = org_map.get(schema)
        if not org_name:
            org_name = "unknown"

        results[schema] = validate_org(engine, org_name, schema, source_schema=source_schema, deep=deep)

    return results
