"""add_organization_id

Revision ID: 4dc6367cdcb4
Revises: 5f3a4b2c8d9e
Create Date: 2026-01-12 16:35:00.928006

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op
from app.db.migration_constants import PUBLIC_SCHEMA

# revision identifiers, used by Alembic.
revision = "4dc6367cdcb4"
down_revision = "5f3a4b2c8d9e"
branch_labels = None
depends_on = None

# Tenant tables that have organizationName column (before this migration removes them)
TENANT_TABLES_WITH_ORG_NAME = [
    "store",
    "tags",
    "team",
    "user",
    "attribute",
    "note",
    "chat",
    "surveyData",
    "chatReplyMessageTemplate",
    "chatAssignRule",
    "chatAssignFilter",
    "organizationSettings",
    "memberFeedData",  # Added in migration be2b83c43277
]


def upgrade():
    # Use version_table_schema to detect current migration target (set by env.py)
    schema = op.get_context().version_table_schema or op.get_context().opts.get("x", {}).get("schema", PUBLIC_SCHEMA)
    is_public = schema == PUBLIC_SCHEMA

    if is_public:
        print(f"Creating migrationLog table in {schema}...")
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
            schema=schema,
        )
        op.create_index("ix_migrationLog_schemaName", "migrationLog", ["schemaName"], schema=schema)
        op.create_index("ix_migrationLog_revision", "migrationLog", ["revision"], schema=schema)

        print(f"Creating organizationMigrationStatus table in {schema}...")
        op.create_table(
            "organizationMigrationStatus",
            sa.Column("organizationName", sa.String(), nullable=False),
            sa.Column("currentPhase", sa.String(20), server_default="NOT_STARTED", nullable=False),
            sa.Column("schemaCreatedAt", sa.DateTime(timezone=True), nullable=True),
            sa.Column("dataCopiedAt", sa.DateTime(timezone=True), nullable=True),
            sa.Column("dualWriteEnabledAt", sa.DateTime(timezone=True), nullable=True),
            sa.Column("readFromNewEnabledAt", sa.DateTime(timezone=True), nullable=True),
            sa.Column("migrationCompletedAt", sa.DateTime(timezone=True), nullable=True),
            sa.Column("lastValidationErrors", postgresql.JSONB(), nullable=True),
            sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("organizationName"),
            sa.ForeignKeyConstraint(["organizationName"], ["public.organization.name"]),
            schema=schema,
        )
    else:
        # Tenant schema: Remove organizationName from all tenant tables
        print(f"Removing organizationName from tenant tables in {schema}...")

        conn = op.get_bind()

        # Special handling for organizationSettings: recreate table without organizationName
        # The table has a composite PK (organizationName, type) which needs to become just (type)
        org_settings_exists = conn.execute(
            sa.text(
                f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = :schema AND table_name = 'organizationSettings')"
            ),
            {"schema": schema},
        ).scalar()

        if org_settings_exists:
            print(f"  Recreating organizationSettings without organizationName...")

            # Drop the old table (it has the wrong PK structure)
            op.drop_table("organizationSettings", schema=schema)

            # Recreate with correct structure for tenant schema (no organizationName, PK is just 'type')
            from sqlalchemy.dialects.postgresql import JSONB

            op.create_table(
                "organizationSettings",
                sa.Column("type", sa.String(), primary_key=True, nullable=False),
                sa.Column("memberFeedSurveyColumnSettings", JSONB, nullable=False, server_default="{}"),
                sa.Column("chatReplySettings", JSONB, nullable=True),
                sa.Column("createdAt", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=True),
                sa.Column("syncedAt", sa.DateTime(timezone=True), nullable=True),
                sa.CheckConstraint("type IN ('memberFeed', 'survey', 'chatReply')", name="type_check"),
                schema=schema,
            )
            print(f"  ✓ Recreated organizationSettings with PK=(type)")

        # Special handling for surveyData: recreate table with correct PK structure
        # The table has a composite PK (organizationName, endUserId) which needs to become just (endUserId)
        survey_data_exists = conn.execute(
            sa.text(
                f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = :schema AND table_name = 'surveyData')"
            ),
            {"schema": schema},
        ).scalar()

        if survey_data_exists:
            print(f"  Recreating surveyData without organizationName...")

            # Save existing data
            existing_data = conn.execute(
                sa.text(
                    f'SELECT "endUserId", "clientUserId", "userSurvey", "createdAt", "updatedAt" FROM {schema}."surveyData"'
                )
            ).fetchall()

            # Drop the old table (it has the wrong PK structure)
            op.drop_table("surveyData", schema=schema)

            # Recreate with correct structure for tenant schema (no organizationName, PK is just 'endUserId')
            op.create_table(
                "surveyData",
                sa.Column("endUserId", sa.String(length=255), primary_key=True, nullable=False),
                sa.Column("clientUserId", sa.String(length=255), nullable=True),
                sa.Column("userSurvey", sa.JSON(), nullable=False),
                sa.Column("createdAt", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=True),
                sa.ForeignKeyConstraint(["endUserId"], [f"{schema}.endUser.userId"]),
                schema=schema,
            )
            op.create_index("ix_surveyData_client_user", "surveyData", ["clientUserId"], unique=False, schema=schema)
            op.create_index("ix_surveyData_end_user", "surveyData", ["endUserId"], unique=False, schema=schema)

            # Restore data
            if existing_data:
                for row in existing_data:
                    conn.execute(
                        sa.text(
                            f"""
                            INSERT INTO {schema}."surveyData" ("endUserId", "clientUserId", "userSurvey", "createdAt", "updatedAt")
                            VALUES (:endUserId, :clientUserId, :userSurvey, :createdAt, :updatedAt)
                        """
                        ),
                        {
                            "endUserId": row[0],
                            "clientUserId": row[1],
                            "userSurvey": row[2],
                            "createdAt": row[3],
                            "updatedAt": row[4],
                        },
                    )
                print(f"  ✓ Recreated surveyData with PK=(endUserId) and restored {len(existing_data)} rows")
            else:
                print(f"  ✓ Recreated surveyData with PK=(endUserId)")

        # Drop FK constraints and organizationName column from tables that have FK
        for table_name in TENANT_TABLES_WITH_ORG_NAME:
            # Skip organizationSettings and surveyData since we already handled them above
            if table_name in ("organizationSettings", "surveyData"):
                continue
            # Check if table exists before attempting to drop
            conn = op.get_bind()
            table_exists = conn.execute(
                sa.text(
                    f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = :schema AND table_name = :table)"
                ),
                {"schema": schema, "table": table_name},
            ).scalar()

            if not table_exists:
                print(f"  Skipping {table_name} (table does not exist in {schema})")
                continue

            # Check if organizationName column exists
            col_exists = conn.execute(
                sa.text(
                    f"SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = :schema AND table_name = :table AND column_name = 'organizationName')"
                ),
                {"schema": schema, "table": table_name},
            ).scalar()

            if not col_exists:
                print(f"  Skipping {table_name} (organizationName column does not exist)")
                continue

            # Special handling for memberFeedData: convert from partitioned to regular table
            if table_name == "memberFeedData":
                print(f"  Handling memberFeedData (dropping partitioned table, will be recreated in tenant schema)...")
                # Drop partitioned table; recreate as normal table in tenant schema
                op.drop_table("memberFeedData", schema=schema)
                print(f"    ✓ Dropped memberFeedData table (no data migration)")
                print(f"    Recreating memberFeedData as non-partitioned table in {schema}...")
                conn.execute(
                    sa.text(
                        f"""
                        CREATE TABLE IF NOT EXISTS \"{schema}\".\"memberFeedData\" (
                            \"id\" UUID NOT NULL DEFAULT gen_random_uuid(),
                            \"clientUserId\" VARCHAR(255) NOT NULL,
                            \"lineUserId\" VARCHAR(255),
                            category1 VARCHAR(255), category2 VARCHAR(255), category3 VARCHAR(255),
                            category4 VARCHAR(255), category5 VARCHAR(255), category6 VARCHAR(255),
                            category7 VARCHAR(255), category8 VARCHAR(255), category9 VARCHAR(255),
                            category10 VARCHAR(255), category11 VARCHAR(255), category12 VARCHAR(255),
                            category13 VARCHAR(255), category14 VARCHAR(255), category15 VARCHAR(255),
                            category16 VARCHAR(255), category17 VARCHAR(255), category18 VARCHAR(255),
                            category19 VARCHAR(255), category20 VARCHAR(255), category21 VARCHAR(255),
                            category22 VARCHAR(255), category23 VARCHAR(255), category24 VARCHAR(255),
                            category25 VARCHAR(255),
                            number1 INTEGER, number2 INTEGER, number3 INTEGER, number4 INTEGER, number5 INTEGER,
                            number6 INTEGER, number7 INTEGER, number8 INTEGER, number9 INTEGER, number10 INTEGER,
                            number11 INTEGER, number12 INTEGER, number13 INTEGER, number14 INTEGER, number15 INTEGER,
                            datetime1 TIMESTAMP WITH TIME ZONE, datetime2 TIMESTAMP WITH TIME ZONE, datetime3 TIMESTAMP WITH TIME ZONE,
                            datetime4 TIMESTAMP WITH TIME ZONE, datetime5 TIMESTAMP WITH TIME ZONE, datetime6 TIMESTAMP WITH TIME ZONE,
                            datetime7 TIMESTAMP WITH TIME ZONE, datetime8 TIMESTAMP WITH TIME ZONE, datetime9 TIMESTAMP WITH TIME ZONE,
                            datetime10 TIMESTAMP WITH TIME ZONE, datetime11 TIMESTAMP WITH TIME ZONE, datetime12 TIMESTAMP WITH TIME ZONE,
                            datetime13 TIMESTAMP WITH TIME ZONE, datetime14 TIMESTAMP WITH TIME ZONE, datetime15 TIMESTAMP WITH TIME ZONE,
                            \"importedAt\" TIMESTAMP WITH TIME ZONE,
                            \"syncedAt\" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            \"createdAt\" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                            \"updatedAt\" TIMESTAMP WITH TIME ZONE,
                            PRIMARY KEY (\"id\")
                        )
                        """
                    )
                )
                op.create_index(
                    "ix_memberFeedData_client_user",
                    "memberFeedData",
                    ["clientUserId"],
                    unique=False,
                    schema=schema,
                )
                print(f"    ✓ Recreated memberFeedData as non-partitioned table")
                continue

            print(f"  Dropping organizationName from {table_name}...")

            # Drop FK constraint (find constraint name dynamically)
            fk_result = conn.execute(
                sa.text(
                    """
                    SELECT constraint_name
                    FROM information_schema.table_constraints
                    WHERE table_schema = :schema
                      AND table_name = :table
                      AND constraint_type = 'FOREIGN KEY'
                      AND constraint_name LIKE '%organizationname%'
                """
                ),
                {"schema": schema, "table": table_name},
            ).fetchone()

            if fk_result:
                fk_name = fk_result[0]
                op.drop_constraint(fk_name, table_name, schema=schema, type_="foreignkey")

            # Drop any indexes on organizationName
            idx_results = conn.execute(
                sa.text(
                    """
                    SELECT indexname
                    FROM pg_indexes
                    WHERE schemaname = :schema
                      AND tablename = :table
                      AND indexdef LIKE '%"organizationName"%'
                """
                ),
                {"schema": schema, "table": table_name},
            ).fetchall()

            for idx_row in idx_results:
                idx_name = idx_row[0]
                # Check if this index backs a PRIMARY KEY constraint
                pk_result = conn.execute(
                    sa.text(
                        """
                        SELECT conname
                        FROM pg_constraint
                        WHERE conrelid = (
                            SELECT oid FROM pg_class WHERE relname = :table AND relnamespace = (
                                SELECT oid FROM pg_namespace WHERE nspname = :schema
                            )
                        )
                        AND contype = 'p'
                        AND conindid = (
                            SELECT oid FROM pg_class WHERE relname = :idx_name AND relnamespace = (
                                SELECT oid FROM pg_namespace WHERE nspname = :schema
                            )
                        )
                    """
                    ),
                    {"schema": schema, "table": table_name, "idx_name": idx_name},
                ).fetchone()

                if pk_result:
                    # This is a PRIMARY KEY index - skip dropping it since it was created
                    # when the table was created and is not specifically for organizationName
                    print(f"  Skipping PK index {idx_name} (primary key of table)")
                    continue

                # Check if this index backs a UNIQUE constraint
                constraint_result = conn.execute(
                    sa.text(
                        """
                        SELECT constraint_name
                        FROM information_schema.table_constraints
                        WHERE table_schema = :schema
                          AND table_name = :table
                          AND constraint_type = 'UNIQUE'
                          AND constraint_name = :idx_name
                    """
                    ),
                    {"schema": schema, "table": table_name, "idx_name": idx_name},
                ).fetchone()

                if constraint_result:
                    # Drop the unique constraint (which will also drop the associated index)
                    constraint_name = constraint_result[0]
                    op.drop_constraint(constraint_name, table_name, schema=schema, type_="unique")
                else:
                    # Drop the index directly
                    op.drop_index(idx_name, table_name, schema=schema)

            # Drop the column
            op.drop_column(table_name, "organizationName", schema=schema)

            # Recreate tenant-appropriate unique constraint for chat clientUserId
            if table_name == "chat":
                client_user_col_exists = conn.execute(
                    sa.text(
                        "SELECT EXISTS (SELECT FROM information_schema.columns "
                        + "WHERE table_schema = :schema AND table_name = 'chat' AND column_name = 'clientUserId')"
                    ),
                    {"schema": schema},
                ).scalar()

                if client_user_col_exists:
                    # Ensure no duplicate constraint name already exists
                    constraint_exists = conn.execute(
                        sa.text(
                            "SELECT EXISTS (SELECT FROM information_schema.table_constraints "
                            + "WHERE table_schema = :schema AND table_name = 'chat' "
                            + "AND constraint_type = 'UNIQUE' AND constraint_name = 'uq_chat_clientUserId')"
                        ),
                        {"schema": schema},
                    ).scalar()

                    if not constraint_exists:
                        op.create_unique_constraint(
                            "uq_chat_clientUserId",
                            "chat",
                            ["clientUserId"],
                            schema=schema,
                        )


def downgrade():
    """
    Standard downgrade: Remove organization.id and migration tracking tables.
    Tenant schemas will be deleted by env.py on downgrade past this revision.
    """
    schema = op.get_context().version_table_schema or op.get_context().opts.get("x", {}).get("schema", PUBLIC_SCHEMA)
    is_public = schema == PUBLIC_SCHEMA

    if not is_public:
        # Tenant schema downgrade: Add organizationName back to tenant tables
        print(f"Downgrading tenant schema {schema}: restoring organizationName columns")

        conn = op.get_bind()

        # Get the organization name for this tenant schema (extract from schema name)
        # Schema format: org_{uuid_without_dashes}
        # We'll need to get the actual organizationName from the organization table

        for table_name in TENANT_TABLES_WITH_ORG_NAME:
            # Check if table exists
            table_check_sql = (
                "SELECT EXISTS (SELECT FROM information_schema.tables "
                "WHERE table_schema = :schema AND table_name = :table)"
            )
            table_exists = conn.execute(
                sa.text(table_check_sql),
                {"schema": schema, "table": table_name},
            ).scalar()

            if not table_exists:
                print(f"  Skipping {table_name} (table does not exist in {schema})")
                continue

            # Check if organizationName column already exists
            col_check_sql = (
                "SELECT EXISTS (SELECT FROM information_schema.columns "
                "WHERE table_schema = :schema AND table_name = :table AND column_name = 'organizationName')"
            )
            col_exists = conn.execute(
                sa.text(col_check_sql),
                {"schema": schema, "table": table_name},
            ).scalar()

            if col_exists:
                print(f"  Skipping {table_name} (organizationName column already exists)")
                continue

            print(f"  Adding organizationName to {table_name}...")

            # Add organizationName column
            op.add_column(table_name, sa.Column("organizationName", sa.String(), nullable=True), schema=schema)

            # We cannot populate it here because we don't have access to the organization table
            # This is expected - the downgrade will drop tenant schemas anyway

        return

    # Public schema downgrade
    print("Downgrading public schema: removing organization.id and migration tables")

    # Step 1: Drop organizationMigrationStatus table (depends on organization.id FK)
    op.drop_table("organizationMigrationStatus", schema=schema)
    print("  ✓ Dropped organizationMigrationStatus table")

    # Step 2: Drop migrationLog table (defensive IF EXISTS for index drops)
    op.execute(sa.text('DROP INDEX IF EXISTS public."ix_migrationLog_revision"'))
    op.execute(sa.text('DROP INDEX IF EXISTS public."ix_migrationLog_schemaName"'))
    op.drop_table("migrationLog", schema=schema)
    print("  ✓ Dropped migrationLog table")

    op.alter_column("auth", "organizationName", nullable=True, schema=schema)

    print("\n✓ Downgrade complete!")
