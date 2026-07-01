"""add markAsReadToken to chatMessage

Revision ID: c7a8b9d0e1f2
Revises: ba192758c92c
Create Date: 2026-05-08 10:00:00

"""

import sqlalchemy as sa

from alembic import op

revision = "c7a8b9d0e1f2"
down_revision = "ba192758c92c"
branch_labels = None
depends_on = None


def upgrade():
    schema = op.get_context().version_table_schema or "public"

    if not schema.startswith("org_") and schema != "tenant_template":
        return

    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("chatMessage", schema=schema)]
    if "markAsReadToken" in columns:
        return

    op.add_column(
        "chatMessage",
        sa.Column("markAsReadToken", sa.String(), nullable=True),
        schema=schema,
    )


def downgrade():
    schema = op.get_context().version_table_schema or "public"

    if not schema.startswith("org_") and schema != "tenant_template":
        return

    op.drop_column("chatMessage", "markAsReadToken", schema=schema)
