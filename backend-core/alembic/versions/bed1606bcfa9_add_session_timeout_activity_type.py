"""add session_timeout activity type

Revision ID: bed1606bcfa9
Revises: ea34f4689996
Create Date: 2026-03-24 17:40:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "bed1606bcfa9"
down_revision = "ea34f4689996"
branch_labels = None
depends_on = None


def upgrade():
    schema = op.get_context().version_table_schema or "public"

    # Skip public and public_old schemas - activitytype enum only exists in tenant schemas
    if not schema.startswith("org_") and schema != "tenant_template":
        return

    op.execute(f'ALTER TYPE "{schema}".activitytype ADD VALUE IF NOT EXISTS \'SESSION_TIMEOUT\'')


def downgrade():
    schema = op.get_context().version_table_schema or "public"

    if not schema.startswith("org_") and schema != "tenant_template":
        return

    op.execute(
        f'UPDATE "{schema}"."chatActivity" '
        "SET \"activityType\" = 'END_SESSION' "
        "WHERE \"activityType\" = 'SESSION_TIMEOUT'"
    )

    op.execute(
        f'CREATE TYPE "{schema}".new_activitytype AS ENUM '
        "('STATUS_CHANGE','USER_CHANGE','TEAMS_CHANGE','END_SESSION',"
        "'USER_FOLLOWED','USER_UNFOLLOWED','USER_FOLLOWED_NEW','USER_ADDED')"
    )

    op.execute(
        f'ALTER TABLE "{schema}"."chatActivity" '
        'ALTER COLUMN "activityType" '
        f'TYPE "{schema}".new_activitytype '
        f"USING \"activityType\"::text::\"{schema}\".new_activitytype"
    )

    op.execute(f'DROP TYPE IF EXISTS "{schema}".activitytype')
    op.execute(f'ALTER TYPE "{schema}".new_activitytype RENAME TO activitytype')
