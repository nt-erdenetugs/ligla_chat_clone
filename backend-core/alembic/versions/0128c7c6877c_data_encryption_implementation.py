"""data encryption implementation

Revision ID: 0128c7c6877c
Revises: a1b2c3d4e5f6
Create Date: 2025-11-20 12:14:18.954536

TODO(JIRA-922): cleanup release — drop the plaintext columns, rename
*Encrypted -> original, drop these triggers + functions, and collapse the
read path. The idx_*_needs_backfill queue indexes are created CONCURRENTLY by
the backfill job, not here, and are dropped implicitly with their columns.
"""

import sqlalchemy as sa

from alembic import op

revision = "0128c7c6877c"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


# (table, plaintext column, encrypted column)
ENCRYPTED_TABLES = (
    ("chatMessage", "content", "contentEncrypted"),
    ("note", "noteValue", "noteValueEncrypted"),
    ("chatAttributeValue", "value", "valueEncrypted"),
)


def upgrade():
    schema = op.get_context().version_table_schema or "public"

    if schema == "public":
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_bigm")
        op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        return

    for table, _, encrypted_col in ENCRYPTED_TABLES:
        op.add_column(table, sa.Column(encrypted_col, sa.LargeBinary(), nullable=True), schema=schema)
        op.add_column(
            table,
            sa.Column("isEncrypted", sa.Boolean(), server_default="false", nullable=False),
            schema=schema,
        )

    with op.get_context().autocommit_block():
        op.execute(f'DROP INDEX CONCURRENTLY IF EXISTS "{schema}"."idx_chat_attribute_value_chat_id"')
        op.execute(
            f'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_note_chat_active" '
            f'ON "{schema}"."note" ("chatId") WHERE "isActive" = true'
        )
        op.execute(
            f'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_cm_delivered_enduser_chat_created" '
            f'ON "{schema}"."chatMessage" ("chatId", "createdAt") '
            f'WHERE "isDelivered" = true AND "senderType" = \'END_USER\''
        )


def downgrade():
    schema = op.get_context().version_table_schema or "public"

    if schema == "public":
        op.execute("DROP EXTENSION IF EXISTS pg_bigm")
        op.execute("DROP EXTENSION IF EXISTS pgcrypto")
        return

    with op.get_context().autocommit_block():
        op.execute(f'DROP INDEX CONCURRENTLY IF EXISTS "{schema}"."idx_note_chat_active"')
        op.execute(f'DROP INDEX CONCURRENTLY IF EXISTS "{schema}"."idx_cm_delivered_enduser_chat_created"')
        # Do not recreate `idx_chat_attribute_value_chat_id`: it never existed
        # in tenant schemas (only `ix_chatAttributeValue_chatId` does), so the
        # upgrade DROP is a no-op there and a recreate would add a redundant
        # index on top of the live one.

    for table, _, encrypted_col in ENCRYPTED_TABLES:
        op.drop_column(table, "isEncrypted", schema=schema)
        op.drop_column(table, encrypted_col, schema=schema)
