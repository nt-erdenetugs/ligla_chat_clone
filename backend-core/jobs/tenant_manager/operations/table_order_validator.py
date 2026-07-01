"""
Validates that TENANT_TABLES migration order respects FK dependencies.

This module prevents FK violations during tenant migration by programmatically
checking that parent tables are migrated before child tables.

Usage:
    from jobs.tenant_manager.operations.table_order_validator import validate_table_order

    # Run at startup or before migration
    errors = validate_table_order(engine, TENANT_TABLES)
    if errors:
        for error in errors:
            logger.error("ERROR: %s", error)
        raise ValueError("Invalid table migration order")
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db.tenant_migration_config import TableSpec

logger = logging.getLogger(__name__)


@dataclass
class FKDependency:
    """Represents a foreign key dependency between tables."""

    child_table: str
    child_column: str
    parent_table: str
    parent_column: str
    constraint_name: str


def get_fk_dependencies(engine: Engine, schema: str = "public") -> list[FKDependency]:
    """
    Query database to get all FK constraints for tenant tables.

    Args:
        engine: SQLAlchemy engine
        schema: Schema to query (default: public, the source schema for migrations)

    Returns:
        List of FK dependencies between tables
    """
    query = text("""
        SELECT
            tc.table_name AS child_table,
            kcu.column_name AS child_column,
            ccu.table_name AS parent_table,
            ccu.column_name AS parent_column,
            tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = :schema
        ORDER BY tc.table_name, tc.constraint_name
    """)

    with engine.connect() as conn:
        rows = conn.execute(query, {"schema": schema}).fetchall()

    return [
        FKDependency(
            child_table=row[0],
            child_column=row[1],
            parent_table=row[2],
            parent_column=row[3],
            constraint_name=row[4],
        )
        for row in rows
    ]


def build_table_index_map(tables: list[TableSpec]) -> dict[str, int]:
    """
    Build mapping of table name to its position in TENANT_TABLES.

    Args:
        tables: List of TableSpec from TENANT_TABLES

    Returns:
        Dict mapping table name to its migration order index
    """
    return {spec.name: idx for idx, spec in enumerate(tables)}


def validate_table_order(engine: Engine, tables: list[TableSpec], schema: str = "public") -> list[str]:
    """
    Validate that TENANT_TABLES order respects FK dependencies.

    Checks that for every FK constraint:
    - Parent table is migrated before child table
    - Self-referencing FKs are allowed (same table)

    Args:
        engine: SQLAlchemy engine
        tables: TENANT_TABLES list to validate
        schema: Schema to query for FK constraints (default: public)

    Returns:
        List of error messages (empty if validation passes)
    """
    fk_deps = get_fk_dependencies(engine, schema)
    table_index = build_table_index_map(tables)
    table_names = set(table_index.keys())
    errors: list[str] = []

    for dep in fk_deps:
        # Skip FKs not in our migration list (e.g., auth table)
        if dep.child_table not in table_names:
            continue

        # Allow self-referencing FKs (e.g., team.parentTeamId -> team.id)
        if dep.parent_table == dep.child_table:
            continue

        # Skip if parent table not in migration (e.g., organization is in public, not migrated)
        if dep.parent_table not in table_names:
            continue

        child_idx = table_index[dep.child_table]
        parent_idx = table_index[dep.parent_table]

        # Parent MUST come before child
        if parent_idx >= child_idx:
            error_msg = (
                f"FK violation: {dep.child_table}.{dep.child_column} -> {dep.parent_table}.{dep.parent_column}\n"
                f"  Parent '{dep.parent_table}' at position {parent_idx} "
                f"must come BEFORE child '{dep.child_table}' at position {child_idx}\n"
                f"  Constraint: {dep.constraint_name}"
            )
            errors.append(error_msg)

    return errors


def print_fk_dependency_graph(engine: Engine, tables: list[TableSpec], schema: str = "public") -> None:
    """
    Print FK dependency graph for visualization and debugging.

    Shows which tables depend on which, ordered by migration sequence.

    Args:
        engine: SQLAlchemy engine
        tables: TENANT_TABLES list
        schema: Schema to query (default: public)
    """
    fk_deps = get_fk_dependencies(engine, schema)
    table_index = build_table_index_map(tables)
    table_names = set(table_index.keys())

    # Build adjacency list: child -> list of parents
    dependencies: dict[str, list[tuple[str, str, str]]] = {}
    for dep in fk_deps:
        if dep.child_table not in table_names or dep.parent_table not in table_names:
            continue
        if dep.parent_table == dep.child_table:  # Skip self-references
            continue

        if dep.child_table not in dependencies:
            dependencies[dep.child_table] = []
        dependencies[dep.child_table].append((dep.parent_table, dep.child_column, dep.parent_column))

    logger.info("\n%s\nFK DEPENDENCY GRAPH (Migration Order)\n%s", "=" * 80, "=" * 80)

    for idx, spec in enumerate(tables):
        table = spec.name
        logger.info("\n[%2d] %s", idx, table)

        if table in dependencies:
            for parent, child_col, parent_col in dependencies[table]:
                parent_idx = table_index[parent]
                status = "✅" if parent_idx < idx else "❌ VIOLATION"
                logger.info(
                    "     └─> Depends on [%2d] %s.%s (%s) %s", parent_idx, parent, parent_col, child_col, status
                )
        else:
            logger.info("     └─> No FK dependencies")

    logger.info("\n%s", "=" * 80)


def validate_and_raise(engine: Engine, tables: list[TableSpec], schema: str = "public") -> None:
    """
    Validate table order and raise ValueError if invalid.

    Use this at startup or before migration to fail fast.

    Args:
        engine: SQLAlchemy engine
        tables: TENANT_TABLES to validate
        schema: Schema to query (default: public)

    Raises:
        ValueError: If table order violates FK dependencies
    """
    errors = validate_table_order(engine, tables, schema)
    if errors:
        error_details = "\n\n".join(errors)
        error_message = (
            f"TENANT_TABLES migration order violates FK dependencies:\n\n{error_details}\n\n"
            "Fix: Reorder tables in backend-core/app/db/tenant_migration_config.py"
        )
        raise ValueError(error_message)
