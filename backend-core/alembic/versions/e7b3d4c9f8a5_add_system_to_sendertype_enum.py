"""add SYSTEM to sendertype enum

Revision ID: e7b3d4c9f8a5
Revises: dbb2a66ab3aa
Create Date: 2025-06-30 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e7b3d4c9f8a5'
down_revision = '02100a6c4b4e'
branch_labels = None
depends_on = None

def upgrade():
    """Add SYSTEM value to existing sendertype enum"""
    # Check if SYSTEM value already exists before adding
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'sendertype' AND e.enumlabel = 'SYSTEM'
            ) THEN
                ALTER TYPE sendertype ADD VALUE 'SYSTEM';
            END IF;
        END $$;
    """)

def downgrade():
    """Remove SYSTEM value from sendertype enum

    Note: PostgreSQL doesn't support removing enum values directly.
    This downgrade recreates the enum without SYSTEM value.
    """
    # Create a new enum without SYSTEM
    op.execute("CREATE TYPE sendertype_new AS ENUM ('END_USER', 'OPERATOR')")

    # Update all SYSTEM messages to OPERATOR (or another fallback strategy)
    op.execute("""
        UPDATE "chatMessage"
        SET "senderType" = 'OPERATOR'
        WHERE "senderType" = 'SYSTEM'
    """)

    # Change column type to new enum
    op.execute("""
        ALTER TABLE "chatMessage"
        ALTER COLUMN "senderType" TYPE sendertype_new
        USING "senderType"::text::sendertype_new
    """)

    # Drop old enum and rename new one
    op.execute("DROP TYPE sendertype")
    op.execute("ALTER TYPE sendertype_new RENAME TO sendertype")
