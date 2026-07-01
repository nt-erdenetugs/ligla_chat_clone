"""add channelId to organization

Revision ID: f4f4b8d3c1a2
Revises: c767f39a1a3c
Create Date: 2026-04-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f4f4b8d3c1a2"
down_revision = "c767f39a1a3c"
branch_labels = None
depends_on = None


def upgrade():
    schema = op.get_context().version_table_schema or "public"
    if schema != "public":
        return

    op.add_column(
        "organization",
        sa.Column("channelId", sa.String(), nullable=False, server_default="00000000"),
    )
    op.alter_column("organization", "channelId", server_default=None)


def downgrade():
    schema = op.get_context().version_table_schema or "public"
    if schema != "public":
        return

    op.drop_column("organization", "channelId")
