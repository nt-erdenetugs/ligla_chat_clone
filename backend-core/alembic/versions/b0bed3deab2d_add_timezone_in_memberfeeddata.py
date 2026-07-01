"""add timezone in memberfeeddata

LEGACY MIGRATION: Partition-based to Schema-per-Tenant Transition

Revision ID: b0bed3deab2d
Revises: a64f6af83d2d
Create Date: 2025-10-24 18:07:16.409448

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import Connection, text

from app.db.migration_constants import PUBLIC_SCHEMA

revision = "b0bed3deab2d"
down_revision = "a64f6af83d2d"
branch_labels = None
depends_on = None

def get_all_partitions(connection: Connection):
    result = connection.execute(
        text(
            """
            SELECT
                child.relname as partition_name,
                pg_get_expr(child.relpartbound, child.oid) as partition_bound
            FROM pg_inherits
            JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
            JOIN pg_class child ON pg_inherits.inhrelid = child.oid
            WHERE parent.relname IN ('memberFeedData', 'memberfeeddata')
        """
        )
    )
    return [(row[0], row[1]) for row in result]

def extract_org_name_from_bound(partition_bound: str):
    import re

    match = re.search(r"FOR VALUES IN \('([^']+)'\)", partition_bound)
    if match:
        return match.group(1)
    return None

def migrate_partition_data(connection: Connection, partition_name: str, org_name: str):
    staging_table = f"{partition_name}_staging_migration"

    # Step 1: Create staging table and copy current data (no conversion yet)
    connection.execute(
        text(
            f"""
            CREATE TABLE "{staging_table}" AS
            SELECT * FROM "{partition_name}"
        """
        )
    )

    # Step 2: Detach partition
    connection.execute(
        text(
            f"""
            ALTER TABLE "memberFeedData"
            DETACH PARTITION "{partition_name}"
        """
        )
    )

    # Step 3: Drop old partition
    connection.execute(text(f'DROP TABLE "{partition_name}" CASCADE'))

    # Step 4: Recreate partition with new schema (after parent table is altered)
    connection.execute(
        text(
            f"""
            CREATE TABLE "{partition_name}" PARTITION OF "memberFeedData"
            FOR VALUES IN ('{org_name}')
        """
        )
    )

    # Step 5: Insert data with timezone conversion
    connection.execute(
        text(
            f"""
            INSERT INTO "{partition_name}"
            SELECT
                id,
                "organizationName",
                "clientUserId",
                "lineUserId",
                category1, category2, category3, category4, category5,
                category6, category7, category8, category9, category10,
                category11, category12, category13, category14, category15,
                category16, category17, category18, category19, category20,
                category21, category22, category23, category24, category25,
                number1, number2, number3, number4, number5,
                number6, number7, number8, number9, number10,
                number11, number12, number13, number14, number15,
                timezone('Asia/Tokyo', datetime1),
                timezone('Asia/Tokyo', datetime2),
                timezone('Asia/Tokyo', datetime3),
                timezone('Asia/Tokyo', datetime4),
                timezone('Asia/Tokyo', datetime5),
                timezone('Asia/Tokyo', datetime6),
                timezone('Asia/Tokyo', datetime7),
                timezone('Asia/Tokyo', datetime8),
                timezone('Asia/Tokyo', datetime9),
                timezone('Asia/Tokyo', datetime10),
                timezone('Asia/Tokyo', datetime11),
                timezone('Asia/Tokyo', datetime12),
                timezone('Asia/Tokyo', datetime13),
                timezone('Asia/Tokyo', datetime14),
                timezone('Asia/Tokyo', datetime15),
                timezone('Asia/Tokyo', "importedAt"),
                timezone('Asia/Tokyo', "syncedAt"),
                timezone('Asia/Tokyo', "createdAt"),
                timezone('Asia/Tokyo', "updatedAt")
            FROM "{staging_table}"
        """
        )
    )

    # Step 6: Clean up staging
    connection.execute(text(f'DROP TABLE "{staging_table}"'))

def upgrade():
    connection: Connection = op.get_bind()
    schema = op.get_context().version_table_schema or op.get_context().opts.get("x", {}).get("schema", PUBLIC_SCHEMA)
    is_public = schema == PUBLIC_SCHEMA

    # Save current timezone and set to Asia/Tokyo for migration
    original_tz = connection.execute(text("SHOW TIMEZONE")).scalar()
    connection.execute(text("SET TIMEZONE='Asia/Tokyo'"))

    partitions = get_all_partitions(connection) if is_public else []

    op.alter_column(
        "memberFeedData",
        "datetime1",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime2",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime3",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime4",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime5",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime6",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime7",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime8",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime9",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime10",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime11",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime12",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime13",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime14",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime15",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )

    if partitions:
        for partition_name, partition_bound in partitions:
            org_name = extract_org_name_from_bound(partition_bound)
            if org_name:
                migrate_partition_data(connection, partition_name, org_name)

    # Restore original timezone
    connection.execute(text(f"SET TIMEZONE='{original_tz}'"))

def downgrade_partition_data(connection: Connection, partition_name: str, org_name: str):
    staging_table = f"{partition_name}_staging_downgrade"

    connection.execute(
        text(
            f"""
            CREATE TABLE "{staging_table}" AS
            SELECT
                id,
                "organizationName",
                "clientUserId",
                "lineUserId",
                category1, category2, category3, category4, category5,
                category6, category7, category8, category9, category10,
                category11, category12, category13, category14, category15,
                category16, category17, category18, category19, category20,
                category21, category22, category23, category24, category25,
                number1, number2, number3, number4, number5,
                number6, number7, number8, number9, number10,
                number11, number12, number13, number14, number15,
                timezone('Asia/Tokyo', datetime1)::TIMESTAMP as datetime1,
                timezone('Asia/Tokyo', datetime2)::TIMESTAMP as datetime2,
                timezone('Asia/Tokyo', datetime3)::TIMESTAMP as datetime3,
                timezone('Asia/Tokyo', datetime4)::TIMESTAMP as datetime4,
                timezone('Asia/Tokyo', datetime5)::TIMESTAMP as datetime5,
                timezone('Asia/Tokyo', datetime6)::TIMESTAMP as datetime6,
                timezone('Asia/Tokyo', datetime7)::TIMESTAMP as datetime7,
                timezone('Asia/Tokyo', datetime8)::TIMESTAMP as datetime8,
                timezone('Asia/Tokyo', datetime9)::TIMESTAMP as datetime9,
                timezone('Asia/Tokyo', datetime10)::TIMESTAMP as datetime10,
                timezone('Asia/Tokyo', datetime11)::TIMESTAMP as datetime11,
                timezone('Asia/Tokyo', datetime12)::TIMESTAMP as datetime12,
                timezone('Asia/Tokyo', datetime13)::TIMESTAMP as datetime13,
                timezone('Asia/Tokyo', datetime14)::TIMESTAMP as datetime14,
                timezone('Asia/Tokyo', datetime15)::TIMESTAMP as datetime15,
                timezone('Asia/Tokyo', "importedAt")::TIMESTAMP as "importedAt",
                timezone('Asia/Tokyo', "syncedAt")::TIMESTAMP as "syncedAt",
                timezone('Asia/Tokyo', "createdAt")::TIMESTAMP as "createdAt",
                timezone('Asia/Tokyo', "updatedAt")::TIMESTAMP as "updatedAt"
            FROM "{partition_name}"
        """
        )
    )

    connection.execute(
        text(
            f"""
            ALTER TABLE "memberFeedData"
            DETACH PARTITION "{partition_name}"
        """
        )
    )

    connection.execute(text(f'DROP TABLE "{partition_name}" CASCADE'))

    connection.execute(
        text(
            f"""
            CREATE TABLE "{partition_name}" PARTITION OF "memberFeedData"
            FOR VALUES IN ('{org_name}')
        """
        )
    )

    connection.execute(
        text(
            f"""
            INSERT INTO "{partition_name}"
            SELECT * FROM "{staging_table}"
        """
        )
    )

    connection.execute(text(f'DROP TABLE "{staging_table}"'))

def downgrade():
    connection: Connection = op.get_bind()

    # Save current timezone and set to Asia/Tokyo for migration
    original_tz = connection.execute(text("SHOW TIMEZONE")).scalar()
    connection.execute(text("SET TIMEZONE='Asia/Tokyo'"))

    partitions = get_all_partitions(connection)

    if partitions:
        for partition_name, partition_bound in partitions:
            org_name = extract_org_name_from_bound(partition_bound)
            if org_name:
                downgrade_partition_data(connection, partition_name, org_name)

    op.alter_column(
        "memberFeedData",
        "datetime15",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime14",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime13",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime12",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime11",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime10",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime9",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime8",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime7",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime6",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime5",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime4",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime3",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime2",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "memberFeedData",
        "datetime1",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )

    # Restore original timezone
    connection.execute(text(f"SET TIMEZONE='{original_tz}'"))
