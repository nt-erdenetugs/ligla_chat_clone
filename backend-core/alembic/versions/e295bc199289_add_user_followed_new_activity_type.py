"""add USER_FOLLOWED_NEW activity type to differentiate new friend vs unblock

Revision ID: e295bc199289
Revises: d9a0cd3a041d
Create Date: 2025-11-14 00:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "e295bc199289"
down_revision = "d9a0cd3a041d"
branch_labels = None
depends_on = None

def upgrade():
    op.execute("ALTER TYPE activitytype ADD VALUE IF NOT EXISTS 'USER_FOLLOWED_NEW'")

def downgrade():
    op.execute(
        'UPDATE "chatActivity" '
        "SET \"activityType\" = 'USER_FOLLOWED' "
        "WHERE \"activityType\" = 'USER_FOLLOWED_NEW'"
    )

    op.execute(
        "CREATE TYPE new_activitytype AS ENUM "
        "('STATUS_CHANGE','USER_CHANGE','TEAMS_CHANGE','END_SESSION','USER_FOLLOWED','USER_UNFOLLOWED')"
    )

    op.execute(
        'ALTER TABLE "chatActivity" '
        'ALTER COLUMN "activityType" '
        'TYPE new_activitytype '
        'USING "activityType"::text::new_activitytype'
    )

    op.execute("DROP TYPE activitytype")
    op.execute("ALTER TYPE new_activitytype RENAME TO activitytype")
