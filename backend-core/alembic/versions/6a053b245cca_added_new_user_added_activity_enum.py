"""added new user_added activity enum

Revision ID: 6a053b245cca
Revises: e295bc199289
Create Date: 2025-11-10 11:55:24.113160

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '6a053b245cca'
down_revision = 'e295bc199289'
branch_labels = None
depends_on = None

def upgrade():
    # Add new enum labels
    op.execute("ALTER TYPE activitytype ADD VALUE IF NOT EXISTS 'USER_ADDED'")
    # ### end Alembic commands ###

def downgrade():
    # 1) Re-assign any rows using USER_ADDED back to an existing value
    op.execute(
        'UPDATE "chatActivity" '
        'SET "activityType" = \'STATUS_CHANGE\' '
        'WHERE "activityType" = \'USER_ADDED\''
    )

    # 2) Recreate the enum without USER_ADDED
    op.execute(
        "CREATE TYPE new_activitytype AS ENUM "
        "('STATUS_CHANGE','USER_CHANGE','TEAMS_CHANGE','END_SESSION','USER_FOLLOWED','USER_UNFOLLOWED', 'USER_FOLLOWED_NEW')"
    )

    # 3) Swap the column back via a text cast
    op.execute(
        'ALTER TABLE "chatActivity" '
        'ALTER COLUMN "activityType" '
        'TYPE new_activitytype '
        'USING "activityType"::text::new_activitytype'
    )

    # 4) Drop the augmented enum and rename the fresh one
    op.execute("DROP TYPE activitytype")
    op.execute("ALTER TYPE new_activitytype RENAME TO activitytype")
    # ### end Alembic commands ###
