from __future__ import annotations

from sqlalchemy.engine import Engine

from app.db.tenant_migration_config import COLUMN_REMAP, ORG_ID_COLS, TENANT_TABLES, TableSpec
from jobs.tenant_manager.operations.introspection import get_exact_table_name


def build_where_clause(
    ts: TableSpec, source_table_name: str, source_schema: str, org_name: str, org_id: str, engine: Engine
) -> tuple[str, str, dict[str, str]]:
    if ts.join_parent is None:
        if ts.org_column == "":
            return (
                f'"{source_schema}"."{source_table_name}"',
                "1=1",
                {},
            )
        source_org_col_name = COLUMN_REMAP.get(ts.name, {}).get(ts.org_column, ts.org_column)
        if ts.org_column in ORG_ID_COLS:
            return (
                f'"{source_schema}"."{source_table_name}"',
                f'"{source_schema}"."{source_table_name}"."{source_org_col_name}" = CAST(:org_id AS UUID)',
                {"org_id": org_id},
            )
        else:
            return (
                f'"{source_schema}"."{source_table_name}"',
                f'"{source_schema}"."{source_table_name}"."{source_org_col_name}" = :org_name AND "{source_schema}"."{source_table_name}"."{source_org_col_name}" IS NOT NULL',
                {"org_name": org_name},
            )
    else:
        parent_table, fk_column, parent_org_column = ts.join_parent

        parent_table_name = get_exact_table_name(engine, source_schema, parent_table)
        if not parent_table_name:
            raise ValueError(f"Parent table {parent_table} not found in schema {source_schema}")

        if ts.reverse_join:
            join_condition = f'"{source_schema}"."{source_table_name}"."{ts.join_child_column}" = "{source_schema}"."{parent_table_name}"."{fk_column}"'
        else:
            join_condition = f'"{source_schema}"."{source_table_name}"."{fk_column}" = "{source_schema}"."{parent_table_name}"."{ts.join_child_column}"'

        if parent_org_column == "":
            join_chain: list[tuple[str, str, str]] = []
            current_table_name = source_table_name
            current_spec = ts
            current_fk_column = fk_column
            visited: set[str] = {ts.name}

            while True:
                parent_spec = next((t for t in TENANT_TABLES if t.name == parent_table), None)
                if parent_spec is None:
                    raise ValueError(
                        f"Parent table '{parent_table}' not found in TENANT_TABLES. "
                        f"Cannot resolve cascade chain for '{ts.name}'. "
                        f"Please add {parent_table} to TENANT_TABLES or fix join_parent configuration."
                    )

                if parent_table in visited:
                    raise ValueError(
                        f"Circular dependency detected in join chain: {' -> '.join(visited)} -> {parent_table}"
                    )
                visited.add(parent_table)

                parent_table_name_resolved = get_exact_table_name(engine, source_schema, parent_table)
                if not parent_table_name_resolved:
                    raise ValueError(f"Parent table {parent_table} not found in schema {source_schema}")

                if current_spec.reverse_join:
                    current_join_cond = (
                        f'"{source_schema}"."{current_table_name}"."{current_spec.join_child_column}" = '
                        f'"{source_schema}"."{parent_table_name_resolved}"."{current_fk_column}"'
                    )
                else:
                    current_join_cond = (
                        f'"{source_schema}"."{current_table_name}"."{current_fk_column}" = '
                        f'"{source_schema}"."{parent_table_name_resolved}"."{current_spec.join_child_column}"'
                    )

                join_chain.append((parent_table_name_resolved, parent_table, current_join_cond))

                if parent_spec.join_parent is None:
                    if parent_spec.org_column == "":
                        where_clause = "1=1"
                        params: dict[str, str] = {}
                    elif parent_spec.org_column in ORG_ID_COLS:
                        where_clause = (
                            f'"{source_schema}"."{parent_table_name_resolved}"."{parent_spec.org_column}" = '
                            f"CAST(:org_id AS UUID)"
                        )
                        params = {"org_id": org_id}
                    else:
                        where_clause = (
                            f'"{source_schema}"."{parent_table_name_resolved}"."{parent_spec.org_column}" = :org_name'
                        )
                        params = {"org_name": org_name}
                    break

                grandparent_table, grandparent_fk, grandparent_org_col = parent_spec.join_parent

                if grandparent_org_col != "":
                    grandparent_name = get_exact_table_name(engine, source_schema, grandparent_table)
                    if not grandparent_name:
                        raise ValueError(f"Grandparent table {grandparent_table} not found in schema {source_schema}")

                    if parent_spec.reverse_join:
                        final_join = (
                            f'"{source_schema}"."{parent_table_name_resolved}"."{parent_spec.join_child_column}" = '
                            f'"{source_schema}"."{grandparent_name}"."{grandparent_fk}"'
                        )
                    else:
                        final_join = (
                            f'"{source_schema}"."{parent_table_name_resolved}"."{grandparent_fk}" = '
                            f'"{source_schema}"."{grandparent_name}".id'
                        )

                    join_chain.append((grandparent_name, grandparent_table, final_join))

                    if grandparent_org_col in ORG_ID_COLS:
                        where_clause = (
                            f'"{source_schema}"."{grandparent_name}"."{grandparent_org_col}" = CAST(:org_id AS UUID)'
                        )
                        params = {"org_id": org_id}
                    else:
                        where_clause = f'"{source_schema}"."{grandparent_name}"."{grandparent_org_col}" = :org_name'
                        params = {"org_name": org_name}
                    break

                current_table_name = parent_table_name_resolved
                current_spec = parent_spec
                parent_table = grandparent_table
                current_fk_column = grandparent_fk

            from_clause = f'"{source_schema}"."{source_table_name}"'
            for join_table, _alias, join_condition_str in join_chain:
                from_clause += f' INNER JOIN "{source_schema}"."{join_table}" ON {join_condition_str}'

            return (from_clause, where_clause, params)

        if parent_org_column in ORG_ID_COLS:
            return (
                f'"{source_schema}"."{source_table_name}" INNER JOIN "{source_schema}"."{parent_table_name}" ON {join_condition}',
                f'"{source_schema}"."{parent_table_name}"."{parent_org_column}" = CAST(:org_id AS UUID)',
                {"org_id": org_id},
            )
        else:
            return (
                f'"{source_schema}"."{source_table_name}" INNER JOIN "{source_schema}"."{parent_table_name}" ON {join_condition}',
                f'"{source_schema}"."{parent_table_name}"."{parent_org_column}" = :org_name',
                {"org_name": org_name},
            )


def build_delete_query_for_target(
    *,
    engine: Engine,
    org_name: str,
    org_id: str,
    target_schema: str,
    table_spec: TableSpec,
) -> tuple[str, dict[str, str]]:
    table_name = get_exact_table_name(engine, target_schema, table_spec.name)
    if not table_name:
        return "", {}

    from_clause, where_clause, params = build_where_clause(
        table_spec, table_name, target_schema, org_name, org_id, engine
    )

    if table_spec.join_parent is None:
        return (
            f'DELETE FROM "{target_schema}"."{table_name}" WHERE {where_clause}',
            params,
        )

    return (
        f'DELETE FROM "{target_schema}"."{table_name}" '
        f"WHERE ctid IN ("
        f'SELECT "{target_schema}"."{table_name}".ctid FROM {from_clause} WHERE {where_clause}'
        f")",
        params,
    )
