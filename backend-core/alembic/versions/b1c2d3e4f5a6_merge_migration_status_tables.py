"""merge organizationMigrationStatus and migrationLog into organizationMigration

Revision ID: b1c2d3e4f5a6
Revises: a8c51c4f7c30
Create Date: 2026-02-10

Merges two similar-purpose tables into one:
- organizationMigrationStatus (phase tracking per org)
- migrationLog (alembic revision tracking per schema)
=> organizationMigration (unified, temporary, deletable later)

Also simplifies MigrationPhase: removes DUAL_WRITE_ENABLED, READ_FROM_NEW, MIGRATION_COMPLETE.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "b1c2d3e4f5a6"
down_revision = "a8c51c4f7c30"
branch_labels = None
depends_on = None

# Phase value mapping: old -> new
PHASE_MAP = {
    "DUAL_WRITE_ENABLED": "DATA_COPIED",
    "READ_FROM_NEW": "DATA_COPIED",
    "READ_FROM_NEW_ENABLED": "DATA_COPIED",
    "MIGRATION_COMPLETE": "COMPLETED",
}


def upgrade():
    schema = op.get_context().version_table_schema or "public"

    # Only run on public schema — this is a shared table
    if schema != "public":
        return

    conn = op.get_bind()

    # 1. Create new table
    op.create_table(
        "organizationMigration",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("organizationName", sa.String(), nullable=True, index=True),
        sa.Column("schemaName", sa.String(), nullable=True, index=True),
        sa.Column("currentPhase", sa.String(20), nullable=False, server_default="NOT_STARTED"),
        sa.Column("schemaCreatedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dataCopiedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("migrationCompletedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lastRevision", sa.String(), nullable=True),
        sa.Column("lastStatus", sa.String(), nullable=True),
        sa.Column("lastError", sa.Text(), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        sa.Column("startedAt", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finishedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=True),
        schema="public",
    )

    op.create_index(
        "ix_organizationMigration_schemaName_unique",
        "organizationMigration",
        ["schemaName"],
        unique=True,
        schema="public",
        postgresql_where=sa.text('"schemaName" IS NOT NULL'),
    )

    # 2. Migrate data from organizationMigrationStatus
    has_old_table = conn.execute(
        sa.text(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'organizationMigrationStatus'
            )
        """
        )
    ).scalar()

    if has_old_table:
        # Map old phase values and JOIN organization to get schemaName
        conn.execute(
            sa.text(
                """
            INSERT INTO public."organizationMigration"
                ("organizationName", "schemaName", "currentPhase", "schemaCreatedAt", "dataCopiedAt",
                 "migrationCompletedAt", "details", "updatedAt")
            SELECT
                oms."organizationName",
                'org_' || REPLACE(CAST(o.id AS TEXT), '-', ''),
                CASE
                    WHEN oms."currentPhase" IN ('DUAL_WRITE_ENABLED', 'READ_FROM_NEW', 'READ_FROM_NEW_ENABLED')
                        THEN 'DATA_COPIED'
                    WHEN oms."currentPhase" = 'MIGRATION_COMPLETE' THEN 'COMPLETED'
                    ELSE oms."currentPhase"
                END,
                oms."schemaCreatedAt",
                oms."dataCopiedAt",
                oms."migrationCompletedAt",
                oms."lastValidationErrors",
                oms."updatedAt"
            FROM public."organizationMigrationStatus" oms
            JOIN public."organization" o ON o.name = oms."organizationName"
        """
            )
        )

    # 3. Merge migrationLog data into existing rows (update schemaName-matched rows)
    has_migration_log = conn.execute(
        sa.text(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'migrationLog'
            )
        """
        )
    ).scalar()

    if has_migration_log:
        conn.execute(
            sa.text(
                """
            UPDATE public."organizationMigration" om
            SET "lastRevision" = ml.revision,
                "lastStatus" = ml.status,
                "lastError" = ml.error,
                "finishedAt" = ml."finishedAt"
            FROM (
                SELECT DISTINCT ON ("schemaName") "schemaName", revision, status, error, "finishedAt"
                FROM public."migrationLog"
                ORDER BY "schemaName", "startedAt" DESC
            ) ml
            WHERE om."schemaName" = ml."schemaName"
        """
            )
        )

    # 4. Drop old tables
    if has_old_table:
        op.drop_table("organizationMigrationStatus", schema="public")
    if has_migration_log:
        op.drop_table("migrationLog", schema="public")


def downgrade():
    schema = op.get_context().version_table_schema or "public"

    if schema != "public":
        return

    conn = op.get_bind()

    # 1. Recreate old tables
    op.create_table(
        "organizationMigrationStatus",
        sa.Column("organizationName", sa.String(), primary_key=True, nullable=False),
        sa.Column("currentPhase", sa.String(20), nullable=False, server_default="NOT_STARTED"),
        sa.Column("schemaCreatedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dataCopiedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dualWriteEnabledAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("readFromNewEnabledAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("migrationCompletedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lastValidationErrors", postgresql.JSONB(), nullable=True),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=True),
        schema="public",
    )

    op.create_table(
        "migrationLog",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("schemaName", sa.String(), nullable=False),
        sa.Column("revision", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("startedAt", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finishedAt", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )
    op.create_index("ix_migrationLog_schemaName", "migrationLog", ["schemaName"], schema="public")
    op.create_index("ix_migrationLog_revision", "migrationLog", ["revision"], schema="public")

    # 2. Migrate phase data back to organizationMigrationStatus
    conn.execute(
        sa.text(
            """
        INSERT INTO public."organizationMigrationStatus"
            ("organizationName", "currentPhase", "schemaCreatedAt", "dataCopiedAt",
             "migrationCompletedAt", "lastValidationErrors", "updatedAt")
        SELECT DISTINCT ON ("organizationName")
            "organizationName",
            CASE
                WHEN "currentPhase" = 'COMPLETED' THEN 'MIGRATION_COMPLETE'
                ELSE "currentPhase"
            END,
            "schemaCreatedAt",
            "dataCopiedAt",
            "migrationCompletedAt",
            "details",
            "updatedAt"
        FROM public."organizationMigration"
        WHERE "organizationName" IS NOT NULL AND "organizationName" != ''
        ORDER BY "organizationName", "updatedAt" DESC NULLS LAST, "startedAt" DESC NULLS LAST
    """
        )
    )

    # 3. Migrate migration log data back to migrationLog
    conn.execute(
        sa.text(
            """
        INSERT INTO public."migrationLog"
            ("schemaName", "revision", "status", "error", "startedAt", "finishedAt")
        SELECT
            "schemaName",
            COALESCE("lastRevision", ''),
            COALESCE("lastStatus", ''),
            "lastError",
            "startedAt",
            "finishedAt"
        FROM public."organizationMigration"
        WHERE "schemaName" IS NOT NULL AND "schemaName" != ''
    """
        )
    )

    # 4. Drop new table
    op.drop_table("organizationMigration", schema="public")
