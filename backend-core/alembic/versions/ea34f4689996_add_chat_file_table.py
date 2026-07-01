"""add chat file table

Revision ID: ea34f4689996
Revises: c7d8e9f0a1b2
Create Date: 2025-10-27 12:52:53.564670

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "ea34f4689996"
down_revision = "c7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade():
    # Enums live in public schema — shared across all tenant schemas
    # checkfirst=True makes this idempotent (safe in both public and tenant context)


    schema = op.get_context().version_table_schema or "public"

    # chatFile is a tenant table — must NOT be created in public schema
    if schema == "public":
        return

    postgresql.ENUM(
        "DOCUMENT",
        "IMAGE",
        "VIDEO",
        "AUDIO",
        "ARCHIVE",
        name="filetype",
        schema=schema,
        create_type=False,
    ).create(op.get_bind(), checkfirst=True)
    postgresql.ENUM(
        "UPLOADING",
        "PENDING_SCAN",
        "SCANNED",
        "VIRUS_DETECTED",
        "DELETED",
        name="filestatus",
        schema=schema,
        create_type=False,
    ).create(op.get_bind(), checkfirst=True)
    postgresql.ENUM(
        "PENDING",
        "PROCESSED",
        "FAILED",
        name="filefolder",
        schema=schema,
        create_type=False,
    ).create(op.get_bind(), checkfirst=True)

    op.create_table(
        "chatFile",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, index=True),
        sa.Column("chatId", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("uploaderOperatorId", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("uploaderEndUserId", sa.String(), nullable=True, index=True),
        sa.Column("fileName", sa.String(), nullable=False),
        sa.Column("originalFileName", sa.String(), nullable=False),
        sa.Column("fileSize", sa.BigInteger(), nullable=False),
        sa.Column("mimeType", sa.String(), nullable=False),
        sa.Column(
            "fileType",
            postgresql.ENUM(
                "DOCUMENT",
                "IMAGE",
                "VIDEO",
                "AUDIO",
                "ARCHIVE",
                name="filetype",
                schema=schema,
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("gcsObjectKey", sa.String(), nullable=False),
        sa.Column(
            "storageFolder",
            postgresql.ENUM(
                "PENDING",
                "PROCESSED",
                "FAILED",
                name="filefolder",
                schema=schema,
                create_type=False,
            ),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "UPLOADING",
                "PENDING_SCAN",
                "SCANNED",
                "VIRUS_DETECTED",
                "DELETED",
                name="filestatus",
                schema=schema,
                create_type=False,
            ),
            server_default="UPLOADING",
            nullable=False,
        ),
        sa.Column("scanResult", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deletedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deletedBy", sa.String(), nullable=True),
        sa.CheckConstraint(
            '(("uploaderOperatorId" IS NOT NULL)::int + ("uploaderEndUserId" IS NOT NULL)::int) = 1',
            name="check_exactly_one_uploader",
        ),
        schema=schema,
    )

def downgrade():
    schema = op.get_context().version_table_schema or "public"

    if schema != "public":
        op.drop_table("chatFile", schema=schema, if_exists=True)
        conn = op.get_bind()
        postgresql.ENUM(name="filefolder", schema=schema).drop(conn, checkfirst=True)
        postgresql.ENUM(name="filestatus", schema=schema).drop(conn, checkfirst=True)
        postgresql.ENUM(name="filetype", schema=schema).drop(conn, checkfirst=True)
        return
