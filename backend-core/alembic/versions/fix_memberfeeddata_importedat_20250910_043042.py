"""fix memberFeedData importedAt column to use timezone

LEGACY MIGRATION: Fix importedAt column type for partitioned tables

Revision ID: fix_importedat_tz
Revises: d99d92de316a
Create Date: 2025-09-10 04:30:42.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'fix_importedat_tz'
down_revision = 'd99d92de316a'
branch_labels = None
depends_on = None

def upgrade():
    """
    Fix the importedAt column in memberFeedData table to use TIMESTAMP WITH TIME ZONE.
    This ensures consistency with the model definition and prevents partition attachment errors.
    """

    # First, check if the table exists and if the column needs fixing
    conn = op.get_bind()

    # Check current column type
    result = conn.execute(sa.text("""
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name IN ('memberFeedData', 'memberfeeddata')
        AND column_name = 'importedAt'
    """)).fetchone()

    if result:
        current_type = result[0]
        print(f"Current importedAt column type: {current_type}")

        # Only alter if it's not already timestamp with time zone
        if current_type == "timestamp without time zone":
            print("Fixing importedAt column to use TIMESTAMP WITH TIME ZONE...")
            op.execute("""
                ALTER TABLE "memberFeedData"
                ALTER COLUMN "importedAt" TYPE TIMESTAMP WITH TIME ZONE
            """)
            print("✅ Fixed importedAt column type")
        else:
            print("✅ importedAt column already has correct type")
    else:
        print("⚠️ memberFeedData table not found - it will be created with correct schema when needed")

def downgrade():
    """
    Revert the importedAt column back to TIMESTAMP (without time zone).
    Note: This is not recommended as it will break partition attachments.
    """

    # Check if table exists before trying to alter
    conn = op.get_bind()
    result = conn.execute(sa.text("""
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('memberFeedData', 'memberfeeddata')
    """)).fetchone()

    if result:
        op.execute("""
            ALTER TABLE "memberFeedData"
            ALTER COLUMN "importedAt" TYPE TIMESTAMP
        """)
