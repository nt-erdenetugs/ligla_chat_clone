"""Fix snake_case fields to camelCase for consistency

Revision ID: 378bb69e2a71
Revises: 6a053b245cca
Create Date: 2025-09-24 14:13:00.000000

"""

import logging
from alembic import op
from sqlalchemy import text

logger = logging.getLogger(__name__)

# revision identifiers, used by Alembic.
revision = "378bb69e2a71"
down_revision = "6a053b245cca"
branch_labels = None
depends_on = None

def upgrade() -> None:
    """
    Safe migration: Add camelCase columns, copy data, drop snake_case columns
    """
    conn = op.get_bind()

    # Store table migration
    # Add new camelCase columns
    conn.execute(
        text(
            """
        ALTER TABLE store
        ADD COLUMN IF NOT EXISTS "typeName" VARCHAR,
        ADD COLUMN IF NOT EXISTS "areaName" VARCHAR,
        ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP
    """
        )
    )

    # Copy data from snake_case to camelCase
    conn.execute(
        text(
            """
        UPDATE store SET
            "typeName" = type_name,
            "areaName" = area_name,
            "startsAt" = starts_at,
            "endsAt" = ends_at
        WHERE type_name IS NOT NULL OR area_name IS NOT NULL OR starts_at IS NOT NULL OR ends_at IS NOT NULL
    """
        )
    )

    # Drop old snake_case columns
    conn.execute(
        text(
            """
        ALTER TABLE store
        DROP COLUMN IF EXISTS type_name,
        DROP COLUMN IF EXISTS area_name,
        DROP COLUMN IF EXISTS starts_at,
        DROP COLUMN IF EXISTS ends_at
    """
        )
    )

    # Attribute table migration
    # Add new camelCase column
    conn.execute(
        text(
            """
        ALTER TABLE attribute
        ADD COLUMN IF NOT EXISTS "chatId" UUID
    """
        )
    )

    # Copy data from snake_case to camelCase
    conn.execute(
        text(
            """
        UPDATE attribute SET
            "chatId" = chat_id
        WHERE chat_id IS NOT NULL
    """
        )
    )

    # Drop old snake_case column
    conn.execute(
        text(
            """
        ALTER TABLE attribute
        DROP COLUMN IF EXISTS chat_id
    """
        )
    )

    # Add foreign key constraint for the new column
    conn.execute(
        text(
            """
        ALTER TABLE attribute
        ADD CONSTRAINT attribute_chatId_fkey
        FOREIGN KEY ("chatId") REFERENCES chat(id)
    """
        )
    )

    # memberFeedData table migration
    # Check if snake_case columns exist
    result = conn.execute(
        text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'memberFeedData'
            AND column_name IN ('imported_at', 'synced_at')
        )
    """
        )
    ).scalar()

    if result:
        # snake_case columns exist, rename them to camelCase
        # Add new camelCase columns with timezone (if they don't exist)
        conn.execute(
            text(
                """
            ALTER TABLE "memberFeedData"
            ADD COLUMN IF NOT EXISTS "importedAt" TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP WITH TIME ZONE
        """
            )
        )

        # Copy data from snake_case to camelCase
        conn.execute(
            text(
                """
            UPDATE "memberFeedData" SET
                "importedAt" = "imported_at",
                "syncedAt" = "synced_at"
        """
            )
        )

        # Drop old snake_case columns
        conn.execute(
            text(
                """
            ALTER TABLE "memberFeedData"
            DROP COLUMN IF EXISTS "imported_at",
            DROP COLUMN IF EXISTS "synced_at"
        """
            )
        )
    else:
        # Columns are already camelCase, just ensure they have correct type
        conn.execute(
            text(
                """
            ALTER TABLE "memberFeedData"
            ALTER COLUMN "importedAt" TYPE TIMESTAMP WITH TIME ZONE,
            ALTER COLUMN "syncedAt" TYPE TIMESTAMP WITH TIME ZONE
        """
            )
        )

def downgrade() -> None:
    """
    Rollback: Add snake_case columns, copy data, drop camelCase columns
    """
    conn = op.get_bind()

    # Store table rollback
    # Check if camelCase columns exist before copying
    camelcase_exists = conn.execute(
        text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'store'
            AND column_name IN ('typeName', 'areaName', 'startsAt', 'endsAt')
        )
    """
        )
    ).scalar()

    # Add snake_case columns back
    conn.execute(
        text(
            """
        ALTER TABLE store
        ADD COLUMN IF NOT EXISTS type_name VARCHAR,
        ADD COLUMN IF NOT EXISTS area_name VARCHAR,
        ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP
    """
        )
    )

    # Only copy data back if camelCase columns exist
    if camelcase_exists:
        conn.execute(
            text(
                """
            UPDATE store SET
                type_name = "typeName",
                area_name = "areaName",
                starts_at = "startsAt",
                ends_at = "endsAt"
            WHERE "typeName" IS NOT NULL OR "areaName" IS NOT NULL
               OR "startsAt" IS NOT NULL OR "endsAt" IS NOT NULL
        """
            )
        )

    # Drop camelCase columns
    conn.execute(
        text(
            """
        ALTER TABLE store
        DROP COLUMN IF EXISTS "typeName",
        DROP COLUMN IF EXISTS "areaName",
        DROP COLUMN IF EXISTS "startsAt",
        DROP COLUMN IF EXISTS "endsAt"
    """
        )
    )

    # Attribute table rollback
    # Check if camelCase column exists before copying
    chatid_exists = conn.execute(
        text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'attribute'
            AND column_name = 'chatId'
        )
    """
        )
    ).scalar()

    # Add snake_case column back if it doesn't exist
    conn.execute(
        text(
            """
        ALTER TABLE attribute
        ADD COLUMN IF NOT EXISTS chat_id UUID
    """
        )
    )

    # Copy data back from camelCase to snake_case only if camelCase column exists
    if chatid_exists:
        conn.execute(
            text(
                """
            UPDATE attribute SET
                chat_id = "chatId"
            WHERE "chatId" IS NOT NULL
        """
            )
        )

        # Drop foreign key constraint and camelCase column
        conn.execute(
            text(
                """
            ALTER TABLE attribute
            DROP CONSTRAINT IF EXISTS attribute_chatId_fkey,
            DROP COLUMN IF EXISTS "chatId"
        """
            )
        )

    # Ensure original foreign key constraint exists (only if it doesn't exist)
    constraint_exists = conn.execute(
        text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'attribute'
            AND constraint_name = 'attribute_chat_id_fkey'
        )
    """
        )
    ).scalar()

    if not constraint_exists:
        conn.execute(
            text(
                """
            ALTER TABLE attribute
            ADD CONSTRAINT attribute_chat_id_fkey
            FOREIGN KEY (chat_id) REFERENCES chat(id)
        """
            )
        )

    # memberFeedData table rollback
    # Check if camelCase columns exist before copying
    camelcase_exists_member = conn.execute(
        text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'memberFeedData'
            AND column_name IN ('importedAt', 'syncedAt')
        )
    """
        )
    ).scalar()

    # Check if snake_case columns exist
    snake_case_exists = conn.execute(
        text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'memberFeedData'
            AND column_name IN ('imported_at', 'synced_at')
        )
    """
        )
    ).scalar()

    if snake_case_exists:
        # snake_case columns exist, just ensure they have correct type
        conn.execute(
            text(
                """
            ALTER TABLE "memberFeedData"
            ALTER COLUMN "imported_at" TYPE TIMESTAMP WITH TIME ZONE,
            ALTER COLUMN "synced_at" TYPE TIMESTAMP WITH TIME ZONE
        """
            )
        )
    else:
        # snake_case columns don't exist, add them and copy from camelCase if available
        conn.execute(
            text(
                """
            ALTER TABLE "memberFeedData"
            ADD COLUMN IF NOT EXISTS "imported_at" TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS "synced_at" TIMESTAMP WITH TIME ZONE
        """
            )
        )

        # Only copy data back if camelCase columns exist
        if camelcase_exists_member:
            conn.execute(
                text(
                    """
                UPDATE "memberFeedData" SET
                    "imported_at" = "importedAt",
                    "synced_at" = "syncedAt"
                WHERE "importedAt" IS NOT NULL OR "syncedAt" IS NOT NULL
            """
                )
            )

        # Drop camelCase columns
        conn.execute(
            text(
                """
            ALTER TABLE "memberFeedData"
            DROP COLUMN IF EXISTS "importedAt",
            DROP COLUMN IF EXISTS "syncedAt"
        """
            )
        )
