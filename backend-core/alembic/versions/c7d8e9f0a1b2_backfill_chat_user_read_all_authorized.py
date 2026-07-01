"""backfill chatUserRead for all authorized users (admins + team members)

Revision ID: c7d8e9f0a1b2
Revises: b1c2d3e4f5a6
Create Date: 2026-02-10

The initial chatUserRead migration (6359e4ab5b3b) only created rows for
chat.assignedUserId. Admins and team members who can also view chats had
no row, causing resolveEffectiveReadTimestamp() to return null and the
unread count to show +99 for all historical messages.

This backfill creates chatUserRead rows for:
1. ADMIN / ADMIN_OPERATOR users — can see all chats in the org
2. Team members — users in teams assigned to a chat (via chatTeamAssignment + userTeam)

readTimestamp = now() marks all existing messages as read at migration time.
"""

import sqlalchemy as sa

from alembic import op

revision = "c7d8e9f0a1b2"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade():
    schema = op.get_context().version_table_schema or "public"

    # Only run in tenant schemas — chatUserRead doesn't exist in shared public
    if not schema.startswith("org_"):
        return

    op.execute(
        sa.text("""
            INSERT INTO "chatUserRead" ("chatId", "userId", "readTimestamp", "createdAt", "updatedAt")
            SELECT c."id", u."id", now(), now(), now()
            FROM "chat" c
            CROSS JOIN "user" u
            WHERE u."roleType" IN ('ADMIN', 'ADMIN_OPERATOR')
              AND u."archivedBy" IS NULL
            ON CONFLICT ("chatId", "userId") DO NOTHING
        """)
    )

    op.execute(
        sa.text("""
            INSERT INTO "chatUserRead" ("chatId", "userId", "readTimestamp", "createdAt", "updatedAt")
            SELECT DISTINCT cta."chatId", ut."userId", now(), now(), now()
            FROM "chatTeamAssignment" cta
            JOIN "userTeam" ut ON ut."teamId" = cta."teamId"
            ON CONFLICT ("chatId", "userId") DO NOTHING
        """)
    )


def downgrade():
    schema = op.get_context().version_table_schema or "public"

    if not schema.startswith("org_"):
        return

    conn = op.get_bind()

    conn.execute(sa.text("""
        CREATE TEMP TABLE _cur_keep ON COMMIT DROP AS
        SELECT cur.*
        FROM "chatUserRead" cur
        JOIN "chat" c ON c."id" = cur."chatId" AND c."assignedUserId" = cur."userId"
    """))

    conn.execute(sa.text('TRUNCATE "chatUserRead"'))

    conn.execute(sa.text("""
        INSERT INTO "chatUserRead" ("chatId", "userId", "readTimestamp", "createdAt", "updatedAt")
        SELECT "chatId", "userId", "readTimestamp", "createdAt", "updatedAt"
        FROM _cur_keep
    """))
