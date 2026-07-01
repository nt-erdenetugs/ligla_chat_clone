"""add sentMethod and deliveryDetails to chatMessage

Revision ID: ba192758c92c
Revises: f4f4b8d3c1a2
Create Date: 2026-04-30 15:00:09

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "ba192758c92c"
down_revision = "f4f4b8d3c1a2"
branch_labels = None
depends_on = None


def upgrade():
    schema = op.get_context().version_table_schema or "public"

    if not schema.startswith("org_") and schema != "tenant_template":
        return

    conn = op.get_bind()

    sentmethod_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_namespace n ON t.typnamespace = n.oid
            WHERE t.typname = 'sentmethod' AND n.nspname = :schema
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if not sentmethod_exists:
        sentmethod_enum = postgresql.ENUM("push", "reply", name="sentmethod", schema=schema)
        sentmethod_enum.create(conn, checkfirst=True)

    col_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = 'chatMessage' AND column_name = 'sentMethod'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if not col_exists:
        op.execute(
            sa.text(
                f'ALTER TABLE "{schema}"."chatMessage" ADD COLUMN "sentMethod" "{schema}".sentmethod'
            )
        )
    else:
        current_type = conn.execute(
            sa.text(
                """
            SELECT udt_name FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = 'chatMessage' AND column_name = 'sentMethod'
        """
            ),
            {"schema": schema},
        ).scalar()

        if current_type in ("varchar", "text"):
            op.execute(
                sa.text(
                    f"""
                ALTER TABLE "{schema}"."chatMessage"
                ALTER COLUMN "sentMethod" TYPE "{schema}".sentmethod
                USING "sentMethod"::text::"{schema}".sentmethod
            """
                )
            )

    delivery_exists = conn.execute(
        sa.text(
            """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = 'chatMessage' AND column_name = 'deliveryDetails'
        )
    """
        ),
        {"schema": schema},
    ).scalar()

    if not delivery_exists:
        op.add_column(
            "chatMessage",
            sa.Column("deliveryDetails", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            schema=schema,
        )


def downgrade():
    schema = op.get_context().version_table_schema or "public"

    if not schema.startswith("org_") and schema != "tenant_template":
        return

    conn = op.get_bind()

    op.drop_column("chatMessage", "deliveryDetails", schema=schema)
    op.drop_column("chatMessage", "sentMethod", schema=schema)
    conn.execute(sa.text(f'DROP TYPE IF EXISTS "{schema}".sentmethod'))
