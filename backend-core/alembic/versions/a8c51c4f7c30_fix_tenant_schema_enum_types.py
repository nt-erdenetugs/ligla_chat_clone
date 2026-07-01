"""fix_tenant_schema_enum_types

Revision ID: a8c51c4f7c30
Revises: 3a2fe1ae7e5c
Create Date: 2026-02-04 23:22:28.464184

This migration fixes enum type issues in tenant schemas:
1. Creates missing 'contenttype' enum (used by chatMessage.type and chatReplyMessageTemplate.type)
2. Creates missing 'logicaloperator', 'conditionoperator', 'valuetype' enums (used by chat assignment tables)
3. Updates column types to use schema-specific enums instead of public schema enums
4. Ensures tenant 'sendertype' enum includes SYSTEM

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "a8c51c4f7c30"
down_revision = "3a2fe1ae7e5c"
branch_labels = None
depends_on = None


def upgrade():
    schema = op.get_context().version_table_schema or op.get_context().opts.get("x", {}).get("schema", "public")

    # Only apply to tenant schemas (org_* and tenant_template), skip public and public_old
    if not schema.startswith("org_") and schema != "tenant_template":
        return

    conn = op.get_bind()

    # 1. Create contenttype enum if it doesn't exist
    contenttype_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_namespace n ON t.typnamespace = n.oid
            WHERE t.typname = 'contenttype' AND n.nspname = :schema
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if not contenttype_exists:
        contenttype_enum = postgresql.ENUM(
            "TEXT", "IMAGE", "VIDEO", "AUDIO", "FILE", "LOCATION", "STICKER", name="contenttype", schema=schema
        )
        contenttype_enum.create(conn, checkfirst=True)

    # 1a. Create logicaloperator enum if it doesn't exist
    logicaloperator_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_namespace n ON t.typnamespace = n.oid
            WHERE t.typname = 'logicaloperator' AND n.nspname = :schema
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if not logicaloperator_exists:
        logicaloperator_enum = postgresql.ENUM("AND", "OR", name="logicaloperator", schema=schema)
        logicaloperator_enum.create(conn, checkfirst=True)

    # 1b. Create conditionoperator enum if it doesn't exist
    conditionoperator_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_namespace n ON t.typnamespace = n.oid
            WHERE t.typname = 'conditionoperator' AND n.nspname = :schema
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if not conditionoperator_exists:
        conditionoperator_enum = postgresql.ENUM(
            "EQUAL",
            "NOT_EQUAL",
            "INCLUDE",
            "NOT_INCLUDE",
            "REGEX",
            "NULL",
            "NOT_NULL",
            "GT",
            "LT",
            "GTE",
            "LTE",
            "VALUES_MATCH_ANY",
            "VALUES_DO_NOT_MATCH_ANY",
            name="conditionoperator",
            schema=schema,
        )
        conditionoperator_enum.create(conn, checkfirst=True)

    # 1c. Create valuetype enum if it doesn't exist
    valuetype_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_namespace n ON t.typnamespace = n.oid
            WHERE t.typname = 'valuetype' AND n.nspname = :schema
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if not valuetype_exists:
        valuetype_enum = postgresql.ENUM(
            "STRING", "NUMBER", "ARRAY", "BOOLEAN", "DATETIME", name="valuetype", schema=schema
        )
        valuetype_enum.create(conn, checkfirst=True)

    # 2. Ensure sendertype enum includes SYSTEM in tenant schema
    sendertype_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_namespace n ON t.typnamespace = n.oid
            WHERE t.typname = 'sendertype' AND n.nspname = :schema
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if sendertype_exists:
        system_value_exists = conn.execute(
            sa.text(
                """
            SELECT EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                JOIN pg_namespace n ON t.typnamespace = n.oid
                WHERE t.typname = 'sendertype'
                  AND n.nspname = :schema
                  AND e.enumlabel = 'SYSTEM'
            )
        """
            ),
            {"schema": schema},
        ).scalar()

        if not system_value_exists:
            op.execute(sa.text(f"ALTER TYPE \"{schema}\".sendertype ADD VALUE 'SYSTEM'"))

    # 3. Fix chatMessage.type column to use schema-specific contenttype enum (if table exists)
    chat_message_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'chatMessage'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if chat_message_exists:
        op.execute(
            sa.text(
                """
            ALTER TABLE "chatMessage"
            ALTER COLUMN type DROP DEFAULT
        """
            )
        )

        op.execute(
            sa.text(
                f"""
            ALTER TABLE "chatMessage"
            ALTER COLUMN type TYPE "{schema}".contenttype
            USING type::text::"{schema}".contenttype
        """
            )
        )

        op.execute(
            sa.text(
                f"""
            ALTER TABLE "chatMessage"
            ALTER COLUMN type SET DEFAULT 'TEXT'::"{schema}".contenttype
        """
            )
        )

    # 4. Fix chatReplyMessageTemplate.type column (if table exists)
    chat_reply_template_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'chatReplyMessageTemplate'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if chat_reply_template_exists:
        op.execute(
            sa.text(
                """
            ALTER TABLE "chatReplyMessageTemplate"
            ALTER COLUMN type DROP DEFAULT
        """
            )
        )

        op.execute(
            sa.text(
                f"""
            ALTER TABLE "chatReplyMessageTemplate"
            ALTER COLUMN type TYPE "{schema}".contenttype
            USING type::text::"{schema}".contenttype
        """
            )
        )

    # 5. Fix chat.chatStatus column (if table exists)
    chat_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'chat'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if chat_exists:
        op.execute(
            sa.text(
                """
            ALTER TABLE chat
            ALTER COLUMN "chatStatus" DROP DEFAULT
        """
            )
        )

        op.execute(
            sa.text(
                f"""
            ALTER TABLE chat
            ALTER COLUMN "chatStatus" TYPE "{schema}".chatstatus
            USING "chatStatus"::text::"{schema}".chatstatus
        """
            )
        )

        op.execute(
            sa.text(
                f"""
            ALTER TABLE chat
            ALTER COLUMN "chatStatus" SET DEFAULT 'PENDING'::"{schema}".chatstatus
        """
            )
        )

    # 6. Fix chatAssignFilterGroup.logicalOperator column (if table exists)
    filter_group_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'chatAssignFilterGroup'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if filter_group_exists:
        op.execute(
            sa.text(
                """
            ALTER TABLE "chatAssignFilterGroup"
            ALTER COLUMN "logicalOperator" DROP DEFAULT
        """
            )
        )

        op.execute(
            sa.text(
                f"""
            ALTER TABLE "chatAssignFilterGroup"
            ALTER COLUMN "logicalOperator" TYPE "{schema}".logicaloperator
            USING "logicalOperator"::text::"{schema}".logicaloperator
        """
            )
        )

        op.execute(
            sa.text(
                f"""
            ALTER TABLE "chatAssignFilterGroup"
            ALTER COLUMN "logicalOperator" SET DEFAULT 'AND'::"{schema}".logicaloperator
        """
            )
        )

    # 7. Fix chatAssignConditionGroup.logicalOperator column (if table exists)
    condition_group_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'chatAssignConditionGroup'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if condition_group_exists:
        op.execute(
            sa.text(
                """
            ALTER TABLE "chatAssignConditionGroup"
            ALTER COLUMN "logicalOperator" DROP DEFAULT
        """
            )
        )

        op.execute(
            sa.text(
                f"""
            ALTER TABLE "chatAssignConditionGroup"
            ALTER COLUMN "logicalOperator" TYPE "{schema}".logicaloperator
            USING "logicalOperator"::text::"{schema}".logicaloperator
        """
            )
        )

        op.execute(
            sa.text(
                f"""
            ALTER TABLE "chatAssignConditionGroup"
            ALTER COLUMN "logicalOperator" SET DEFAULT 'AND'::"{schema}".logicaloperator
        """
            )
        )

    # 8. Fix chatAssignCondition columns (if table exists)
    condition_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'chatAssignCondition'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if condition_exists:
        op.execute(
            sa.text(
                f"""
            ALTER TABLE "chatAssignCondition"
            ALTER COLUMN operator TYPE "{schema}".conditionoperator
            USING operator::text::"{schema}".conditionoperator
        """
            )
        )

        op.execute(
            sa.text(
                f"""
            ALTER TABLE "chatAssignCondition"
            ALTER COLUMN "valueType" TYPE "{schema}".valuetype
            USING "valueType"::text::"{schema}".valuetype
        """
            )
        )


def downgrade():
    schema = op.get_context().version_table_schema or op.get_context().opts.get("x", {}).get("schema", "public")

    # Only apply to tenant schemas
    if not schema.startswith("org_"):
        return

    conn = op.get_bind()

    # Revert chatMessage.type (if table exists)
    chat_message_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'chatMessage'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if chat_message_exists:
        op.execute(
            sa.text(
                """
            ALTER TABLE "chatMessage"
            ALTER COLUMN type DROP DEFAULT
        """
            )
        )

        op.execute(
            sa.text(
                """
            ALTER TABLE "chatMessage"
            ALTER COLUMN type TYPE public.contenttype
            USING type::text::public.contenttype
        """
            )
        )

        op.execute(
            sa.text(
                """
            ALTER TABLE "chatMessage"
            ALTER COLUMN type SET DEFAULT 'TEXT'::public.contenttype
        """
            )
        )

    # Revert chatReplyMessageTemplate.type (if table exists)
    chat_reply_template_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'chatReplyMessageTemplate'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if chat_reply_template_exists:
        op.execute(
            sa.text(
                """
            ALTER TABLE "chatReplyMessageTemplate"
            ALTER COLUMN type TYPE public.contenttype
            USING type::text::public.contenttype
        """
            )
        )

    # Revert chat.chatStatus (if table exists)
    chat_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'chat'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if chat_exists:
        op.execute(
            sa.text(
                """
            ALTER TABLE chat
            ALTER COLUMN "chatStatus" DROP DEFAULT
        """
            )
        )

        op.execute(
            sa.text(
                """
            ALTER TABLE chat
            ALTER COLUMN "chatStatus" TYPE public."chatStatus"
            USING "chatStatus"::text::public."chatStatus"
        """
            )
        )

        op.execute(
            sa.text(
                """
            ALTER TABLE chat
            ALTER COLUMN "chatStatus" SET DEFAULT 'PENDING'::public."chatStatus"
        """
            )
        )

    # Revert chatAssignFilterGroup.logicalOperator to public schema (if table exists)
    filter_group_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'chatAssignFilterGroup'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if filter_group_exists:
        op.execute(
            sa.text(
                """
            ALTER TABLE "chatAssignFilterGroup"
            ALTER COLUMN "logicalOperator" DROP DEFAULT
        """
            )
        )

        op.execute(
            sa.text(
                """
            ALTER TABLE "chatAssignFilterGroup"
            ALTER COLUMN "logicalOperator" TYPE public.logicaloperator
            USING "logicalOperator"::text::public.logicaloperator
        """
            )
        )

        op.execute(
            sa.text(
                """
            ALTER TABLE "chatAssignFilterGroup"
            ALTER COLUMN "logicalOperator" SET DEFAULT 'AND'::public.logicaloperator
        """
            )
        )

    # Revert chatAssignConditionGroup.logicalOperator to public schema (if table exists)
    condition_group_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'chatAssignConditionGroup'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if condition_group_exists:
        op.execute(
            sa.text(
                """
            ALTER TABLE "chatAssignConditionGroup"
            ALTER COLUMN "logicalOperator" DROP DEFAULT
        """
            )
        )

        op.execute(
            sa.text(
                """
            ALTER TABLE "chatAssignConditionGroup"
            ALTER COLUMN "logicalOperator" TYPE public.logicaloperator
            USING "logicalOperator"::text::public.logicaloperator
        """
            )
        )

        op.execute(
            sa.text(
                """
            ALTER TABLE "chatAssignConditionGroup"
            ALTER COLUMN "logicalOperator" SET DEFAULT 'AND'::public.logicaloperator
        """
            )
        )

    # Revert chatAssignCondition columns to public schema (if table exists)
    condition_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'chatAssignCondition'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if condition_exists:
        op.execute(
            sa.text(
                """
            ALTER TABLE "chatAssignCondition"
            ALTER COLUMN operator TYPE public.conditionoperator
            USING operator::text::public.conditionoperator
        """
            )
        )

        op.execute(
            sa.text(
                """
            ALTER TABLE "chatAssignCondition"
            ALTER COLUMN "valueType" TYPE public.valuetype
            USING "valueType"::text::public.valuetype
        """
            )
        )

    # Drop enums from schema
    conn.execute(sa.text(f'DROP TYPE IF EXISTS "{schema}".valuetype'))
    conn.execute(sa.text(f'DROP TYPE IF EXISTS "{schema}".conditionoperator'))
    conn.execute(sa.text(f'DROP TYPE IF EXISTS "{schema}".logicaloperator'))
    conn.execute(sa.text(f'DROP TYPE IF EXISTS "{schema}".contenttype'))
