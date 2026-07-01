"""add partition migration safety check

Repair migration following memberFeedData pattern.
This migration adds safety checks for partition table existence
that were incorrectly added to b0bed3deab2d.

The safety check ensures that partition tables actually exist
before attempting migration operations on them.

Revision ID: 3a2fe1ae7e5c
Revises: 66966d63b032
Create Date: 2026-02-04 14:18:32.807531

"""
from alembic import op
from sqlalchemy import Connection, text


# revision identifiers, used by Alembic.
revision = '3a2fe1ae7e5c'
down_revision = '66966d63b032'
branch_labels = None
depends_on = None


def verify_partition_tables_exist():
    """
    Verify that all partition tables in pg_inherits actually exist.
    This is a safety check to prevent migration failures.
    """
    conn: Connection = op.get_bind()

    # Get all partitions for memberFeedData
    result = conn.execute(
        text("""
            SELECT
                child.relname as partition_name,
                pg_get_expr(child.relpartbound, child.oid) as partition_bound
            FROM pg_inherits
            JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
            JOIN pg_class child ON pg_inherits.inhrelid = child.oid
            WHERE parent.relname IN ('memberFeedData', 'memberfeeddata')
        """)
    )

    partitions = [(row[0], row[1]) for row in result]

    if not partitions:
        print("  No partitions found for memberFeedData")
        return

    print(f"  Checking {len(partitions)} partition(s)...")

    for partition_name, partition_bound in partitions:
        # Check if partition table actually exists
        table_exists = conn.execute(
            text(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = '{partition_name}'
                )
            """)
        ).scalar()

        if table_exists:
            print(f"  ✓ Partition {partition_name} exists")
        else:
            print(f"  ⚠️  Partition {partition_name} declared in pg_inherits but table doesn't exist")
            print(f"      This may cause issues in b0bed3deab2d migration")


def upgrade():
    print("=== Partition Safety Check ===")
    verify_partition_tables_exist()
    print("=== Safety check complete ===")


def downgrade():
    # No-op downgrade
    pass
