"""add loginLiffId and fileUploadLiffId to organization

Revision ID: a1b2c3d4e5f6
Revises: c7a8b9d0e1f2
Create Date: 2026-05-08 00:00:00.000000

Phase 1 of a zero-downtime migration:
- Adds loginLiffId (backfilled from liffId)
- Adds fileUploadLiffId
- Keeps liffId and channelId intact so old code continues to work

Phase 2 (run after code deploy): b2c3d4e5f6a1_drop_liff_id_and_channel_id.py
"""
from alembic import op
import sqlalchemy as sa


revision = "a1b2c3d4e5f6"
down_revision = "c7a8b9d0e1f2"
branch_labels = None
depends_on = None



def upgrade():
    schema = op.get_context().version_table_schema or "public"

    # organization is a public table — must NOT be run on non-public schemas to avoid breaking other tenants
    if schema != "public":
        return

    op.add_column("organization", sa.Column("loginLiffId", sa.String(), nullable=True))
    op.add_column("organization", sa.Column("fileUploadLiffId", sa.String(), nullable=True))
    op.drop_column("organization", "channelId")
    op.execute('UPDATE public.organization SET "loginLiffId" = "liffId"')

def downgrade():
    schema = op.get_context().version_table_schema or "public"

    # organization is a public table — must NOT be run on non-public schemas to avoid breaking other tenants
    if schema != "public":
        return

    op.drop_column("organization", "fileUploadLiffId")
    op.drop_column("organization", "loginLiffId")
    op.add_column(
        "organization",
        sa.Column("channelId", sa.String(), nullable=False, server_default="00000000"),
    )
    op.alter_column("organization", "channelId", server_default=None)
