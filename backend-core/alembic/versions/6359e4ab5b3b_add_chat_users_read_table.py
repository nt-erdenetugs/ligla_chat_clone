"""add_chat_users_read_table

Revision ID: 6359e4ab5b3b
Revises: d4b8e9c7f2a1
Create Date: 2026-01-23 17:27:35.852975

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "6359e4ab5b3b"
down_revision = "d4b8e9c7f2a1"
branch_labels = None
depends_on = None


def upgrade():
    schema = op.get_context().opts.get("x", {}).get("schema", "public")

    op.create_table(
        "chatUserRead",
        sa.Column("chatId", sa.UUID(), nullable=False),
        sa.Column("userId", sa.UUID(), nullable=False),
        sa.Column(
            "readTimestamp",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "createdAt",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("chatId", "userId"),
    )

    op.create_index("idx_chat_user_read_user", "chatUserRead", ["userId"])

    op.create_foreign_key(
        "chatUserRead_chatId_fkey",
        "chatUserRead",
        "chat",
        ["chatId"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "chatUserRead_userId_fkey",
        "chatUserRead",
        "user",
        ["userId"],
        ["id"],
        ondelete="CASCADE",
    )

    # Per-tenant data migration: populate from existing chat data
    if schema.startswith("org_") or schema == "public":
        op.execute(
            sa.text("""
            INSERT INTO "chatUserRead" ("chatId", "userId", "readTimestamp", "createdAt", "updatedAt")
            SELECT "id", "assignedUserId",
                   COALESCE("latestReadTimestamp", "createdAt"), now(), now()
            FROM "chat"
            WHERE "assignedUserId" IS NOT NULL
            ON CONFLICT ("chatId", "userId") DO NOTHING
        """)
        )


def downgrade():
    op.drop_constraint("chatUserRead_userId_fkey", "chatUserRead", type_="foreignkey")
    op.drop_constraint("chatUserRead_chatId_fkey", "chatUserRead", type_="foreignkey")
    op.drop_index("idx_chat_user_read_user", table_name="chatUserRead")
    op.drop_table("chatUserRead")
