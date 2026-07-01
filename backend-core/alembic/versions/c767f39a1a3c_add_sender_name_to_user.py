"""add sender_name to user table

Revision ID: c767f39a1a3c
Revises: bed1606bcfa9
Create Date: 2026-04-03

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c767f39a1a3c'
down_revision = 'bed1606bcfa9'
branch_labels = None
depends_on = None


def upgrade():
    schema = op.get_context().version_table_schema or "public"

    # user table only exists in tenant schemas, not public
    if not schema.startswith("org_") and schema != "tenant_template":
        return

    op.execute(
        f'ALTER TABLE "{schema}"."user" '
        f'ADD COLUMN IF NOT EXISTS "senderName" VARCHAR'
    )


def downgrade():
    schema = op.get_context().version_table_schema or "public"

    if not schema.startswith("org_") and schema != "tenant_template":
        return

    op.execute(
        f'ALTER TABLE "{schema}"."user" '
        f'DROP COLUMN IF EXISTS "senderName"'
    )
