"""backup public and create shared-only public

Revision ID: 5f3a4b2c8d9e
Revises: de1fc187c8b7
Create Date: 2026-01-20 11:45:00.000000

"""

import logging

from alembic import op
import sqlalchemy as sa

logger = logging.getLogger(__name__)

# Import migration constants
from app.db.migration_constants import SHARED_TABLES, TENANT_TABLES, PUBLIC_OLD_SCHEMA  # type: ignore  # noqa: E402

# Note: TENANT_TABLES imported for reference/documentation
_ = TENANT_TABLES  # Mark as used for documentation purposes


# revision identifiers, used by Alembic.
revision = "5f3a4b2c8d9e"
down_revision = "de1fc187c8b7"
branch_labels = None
depends_on = None


def upgrade():
    """
    Backup current public schema to public_old and recreate public with only shared tables.

    This migration should ONLY run on public schema.
    """
    schema = op.get_context().version_table_schema or op.get_context().opts.get("x", {}).get("schema", "public")
    is_public = schema == "public"

    if not is_public:
        print(f"Skipping backup migration for tenant schema: {schema}")
        return

    conn = op.get_bind()

    print(f"Adding id column to organization table in {schema}...")
    op.add_column(
        "organization",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=True),
        schema=schema,
    )
    # Populate existing rows with UUIDs
    op.execute("UPDATE public.organization SET id = gen_random_uuid() WHERE id IS NULL")
    # Now make it non-nullable and add constraints (preserve server_default)
    op.alter_column(
        "organization",
        "id",
        nullable=False,
        server_default=sa.text("gen_random_uuid()"),
        schema=schema
    )
    op.create_index("ix_organization_id", "organization", ["id"], schema=schema, unique=True)

    # Step 1: Check if public_old already exists
    public_old_exists = conn.execute(
        sa.text(f"SELECT EXISTS (SELECT FROM pg_namespace WHERE nspname = '{PUBLIC_OLD_SCHEMA}')")
    ).scalar()

    if public_old_exists:
        print(f"ERROR: {PUBLIC_OLD_SCHEMA} schema already exists. This migration has likely already been run.")
        print(f"If you want to re-run this migration, manually drop {PUBLIC_OLD_SCHEMA} schema first.")
        raise Exception(f"{PUBLIC_OLD_SCHEMA} schema already exists")

    print("Step 1: Creating backup of public schema as public_old...")

    # Step 1a: Move alembic_version temporarily to a safe location
    # Check if alembic_version exists
    alembic_check_query = (
        "SELECT EXISTS (SELECT FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'alembic_version')"
    )
    alembic_version_exists = conn.execute(sa.text(alembic_check_query)).scalar()

    alembic_version_data = None
    if alembic_version_exists:
        # Save the current version
        alembic_version_data = conn.execute(sa.text("SELECT version_num FROM public.alembic_version")).scalar()
        print(f"  ℹ Saved alembic_version state: {alembic_version_data}")

    # Step 1b: Rename public to public_old
    conn.execute(sa.text("ALTER SCHEMA public RENAME TO public_old"))
    print("  ✓ Renamed public → public_old")

    # Step 1c: Create new empty public schema
    conn.execute(sa.text("CREATE SCHEMA public"))
    print("  ✓ Created new empty public schema")

    # Step 1d: Grant permissions on new public schema
    # Get current database user from connection
    current_user = conn.execute(sa.text("SELECT current_user")).scalar()
    conn.execute(sa.text("GRANT ALL ON SCHEMA public TO PUBLIC"))
    # Quote username for Cloud SQL service accounts with special characters
    conn.execute(sa.text(f'GRANT ALL ON SCHEMA public TO "{current_user}"'))
    print(f"  ✓ Granted permissions on public schema (user: {current_user})")

    # Step 1e: Recreate alembic_version table in new public schema
    if alembic_version_exists:
        create_alembic_query = (
            "CREATE TABLE public.alembic_version (version_num VARCHAR(32) NOT NULL, "
            "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
        )
        conn.execute(sa.text(create_alembic_query))
        # Insert the old version - Alembic will update it to current after migration completes
        conn.execute(
            sa.text("INSERT INTO public.alembic_version (version_num) VALUES (:version)"),
            {"version": alembic_version_data},
        )
        print(f"  ✓ Recreated alembic_version table with version: {alembic_version_data}")

    # Step 1f: Recreate shared enum types in new public
    userstatus_exists = conn.execute(
        sa.text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = :schema AND t.typname = :type
            )
            """
        ),
        {"schema": PUBLIC_OLD_SCHEMA, "type": "userstatus"},
    ).scalar()

    if userstatus_exists:
        public_userstatus_exists = conn.execute(
            sa.text(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_type t
                    JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE n.nspname = :schema AND t.typname = :type
                )
                """
            ),
            {"schema": "public", "type": "userstatus"},
        ).scalar()

        if not public_userstatus_exists:
            enum_labels = conn.execute(
                sa.text(
                    """
                    SELECT e.enumlabel
                    FROM pg_type t
                    JOIN pg_enum e ON t.oid = e.enumtypid
                    JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE n.nspname = :schema AND t.typname = :type
                    ORDER BY e.enumsortorder
                    """
                ),
                {"schema": PUBLIC_OLD_SCHEMA, "type": "userstatus"},
            ).fetchall()

            labels = [row[0].replace("'", "''") for row in enum_labels]
            if labels:
                labels_sql = ", ".join([f"'{label}'" for label in labels])
                conn.execute(sa.text(f"CREATE TYPE public.userstatus AS ENUM ({labels_sql})"))
                print("  ✓ Recreated enum public.userstatus")
            else:
                print("  ⚠ Skipping enum public.userstatus (no labels found)")

    # Step 2: Copy ONLY shared tables from public_old to new public
    print("\nStep 2: Copying shared tables from public_old to public...")

    for table_name in SHARED_TABLES:
        # Check if table exists in public_old
        table_check_query = (
            "SELECT EXISTS (SELECT FROM information_schema.tables "
            "WHERE table_schema = 'public_old' AND table_name = :table)"
        )
        table_exists = conn.execute(sa.text(table_check_query), {"table": table_name}).scalar()

        if not table_exists:
            print(f"  ⚠ Skipping {table_name} (does not exist in public_old)")
            continue

        print(f"  Copying {table_name}...")

        # Create table structure (simplified approach - copy with data)
        conn.execute(sa.text(f'CREATE TABLE public."{table_name}" AS TABLE public_old."{table_name}"'))

        # Restore NOT NULL constraints lost by CREATE TABLE AS
        not_null_columns = conn.execute(
            sa.text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public_old'
                  AND table_name = :table
                  AND is_nullable = 'NO'
                ORDER BY ordinal_position
                """
            ),
            {"table": table_name},
        ).fetchall()

        for (column_name,) in not_null_columns:
            conn.execute(sa.text(f'ALTER TABLE public."{table_name}" ALTER COLUMN "{column_name}" SET NOT NULL'))

        # Copy constraints (primary keys, foreign keys, unique constraints)
        # Get primary key
        pk_query = """
            SELECT string_agg('"' || a.attname || '"', ', ' ORDER BY array_position(conkey, a.attnum))
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE c.contype = 'p'
              AND c.conrelid = ('public_old."' || :table || '"')::regclass
        """
        pk_result = conn.execute(sa.text(pk_query), {"table": table_name}).scalar()

        if pk_result:
            conn.execute(sa.text(f'ALTER TABLE public."{table_name}" ADD PRIMARY KEY ({pk_result})'))

        # Copy indexes and unique constraints (with deduplication)
        # Get all indexes with their column definitions to detect duplicates
        idx_query = """
            SELECT
                i.indexname,
                i.indexdef,
                string_agg(a.attname, ',' ORDER BY array_position(ix.indkey::int[], a.attnum)) as columns,
                ix.indisunique
            FROM pg_indexes i
            JOIN pg_class c ON c.relname = i.tablename AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = i.schemaname)
            JOIN pg_class ic ON ic.relname = i.indexname AND ic.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = i.schemaname)
            JOIN pg_index ix ON ix.indexrelid = ic.oid
            JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(ix.indkey)
            WHERE i.schemaname = 'public_old'
              AND i.tablename = :table
              AND i.indexname NOT LIKE '%_pkey'
            GROUP BY i.indexname, i.indexdef, ix.indisunique
            ORDER BY i.indexname
        """
        indexes = conn.execute(sa.text(idx_query), {"table": table_name}).fetchall()

        # Track unique constraint column sets to avoid duplicates
        seen_unique_columns = set()

        for idx_name, idx_def, columns, is_unique in indexes:
            # For unique constraints, skip if we've already created one for this column set
            if is_unique:
                if columns in seen_unique_columns:
                    print(f"    ⏭ Skipping duplicate unique constraint {idx_name} on ({columns})")
                    continue
                seen_unique_columns.add(columns)

            # Replace public_old with public in index definition
            new_idx_def = idx_def.replace("public_old.", "public.")
            try:
                conn.execute(sa.text(new_idx_def))
            except Exception as e:
                logger.warning(f"Could not create index {idx_name}: {e}")

    # Step 2b: Ensure organization.id unique constraint exists
    print("\nStep 2b: Ensuring organization.id unique constraint...")
    org_id_index_exists = conn.execute(
        sa.text("""
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'organization'
                  AND indexname = 'ix_organization_id'
            )
        """)
    ).scalar()

    if not org_id_index_exists:
        print("  Creating unique index on organization.id...")
        conn.execute(sa.text("CREATE UNIQUE INDEX ix_organization_id ON public.organization (id)"))
        print("  ✓ Created unique index ix_organization_id")
    else:
        print("  ✓ Unique index ix_organization_id already exists")

    # Step 2c: Restore column defaults for all shared tables (lost during CREATE TABLE AS)
    print("\nStep 2c: Restoring column defaults lost during CREATE TABLE AS...")
    print("  Note: CREATE TABLE AS does NOT preserve column defaults (server_default, default)")
    print("  This step systematically restores all column defaults from the models.")

    # Define all column defaults that need to be restored
    # Format: "table_name": {"column_name": "sql_default_expression"}
    TABLE_COLUMN_DEFAULTS = {
        "hypervisorUser": {
            "id": "gen_random_uuid()",
            "createdAt": "now()",
        },
        "organization": {
            "id": "gen_random_uuid()",
            "apiKey": "''::text",
            "maxOperator": "50",
            "isActive": "true",
            "createdAt": "now()",
        },
        "organizationMigrationStatus": {
            "currentPhase": "'NOT_STARTED'::character varying",
        },
        "migrationLog": {
            "id": "gen_random_uuid()",
            "startedAt": "now()",
        },
        "auth": {
            "id": "gen_random_uuid()",
            "createdAt": "now()",
            "loginAttempts": "0",
            # Note: status column default is handled separately in Step 2e
            # because it requires the userstatus enum to be properly set up first
        },
        "userPasswordResetToken": {
            "createdAt": "now()",
        },
    }

    for table_name, columns in TABLE_COLUMN_DEFAULTS.items():
        table_exists = conn.execute(
            sa.text(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = :table
                )
                """
            ),
            {"table": table_name},
        ).scalar()

        if not table_exists:
            print(f"    ⏭ Skipping {table_name} (does not exist in public)")
            continue

        print(f"  Restoring defaults for {table_name}...")

        for column_name, default_value in columns.items():
            current_default = conn.execute(
                sa.text(
                    """
                    SELECT column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = :table
                      AND column_name = :column
                    """
                ),
                {"table": table_name, "column": column_name},
            ).scalar()

            if current_default:
                print(f"    ⏭ {table_name}.{column_name} already has default: {current_default}")
                continue

            try:
                conn.execute(
                    sa.text(
                        f'ALTER TABLE public."{table_name}" ALTER COLUMN "{column_name}" SET DEFAULT {default_value}'
                    )
                )
                print(f"    ✓ Set {table_name}.{column_name} DEFAULT {default_value}")
            except Exception as e:
                logger.warning(f"Could not set default for {table_name}.{column_name}: {e}")

    # Step 2d: Fix auth-specific schema issues (nullable, indexes)
    print("\nStep 2d: Fixing auth-specific schema issues...")

    auth_exists = conn.execute(
        sa.text(
            """
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'auth'
            )
            """
        )
    ).scalar()

    if auth_exists:
        # Fix 1: Make organizationName nullable (current model has nullable=True)
        org_name_nullable = conn.execute(
            sa.text(
                """
                SELECT is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'auth'
                  AND column_name = 'organizationName'
                """
            )
        ).scalar()

        if org_name_nullable == "NO":
            conn.execute(sa.text('ALTER TABLE public."auth" ALTER COLUMN "organizationName" DROP NOT NULL'))
            print("  ✓ Made auth.organizationName nullable (matches current model)")

        # Fix 2: Ensure index on organizationName exists
        org_name_index_exists = conn.execute(
            sa.text(
                """
                SELECT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND tablename = 'auth'
                      AND indexname LIKE '%organizationName%'
                )
                """
            )
        ).scalar()

        if not org_name_index_exists:
            conn.execute(sa.text('CREATE INDEX ix_auth_organization_name ON public."auth" ("organizationName")'))
            print("  ✓ Created index on auth.organizationName")

    # Step 2e: Ensure auth.status uses enum from new public schema
    auth_table_exists = conn.execute(
        sa.text(
            """
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'auth'
            )
            """
        )
    ).scalar()

    if auth_table_exists:
        auth_status_type_schema = conn.execute(
            sa.text(
                """
                SELECT n.nspname
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                JOIN pg_type t ON t.oid = a.atttypid
                JOIN pg_namespace n ON n.oid = t.typnamespace
                JOIN pg_namespace ns ON ns.oid = c.relnamespace
                WHERE ns.nspname = 'public'
                  AND c.relname = 'auth'
                  AND a.attname = 'status'
                """
            )
        ).scalar()

        if auth_status_type_schema and auth_status_type_schema != "public":
            public_userstatus_exists = conn.execute(
                sa.text(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM pg_type t
                        JOIN pg_namespace n ON n.oid = t.typnamespace
                        WHERE n.nspname = :schema AND t.typname = :type
                    )
                    """
                ),
                {"schema": "public", "type": "userstatus"},
            ).scalar()

            if public_userstatus_exists:
                conn.execute(
                    sa.text(
                        """
                        ALTER TABLE public."auth"
                        ALTER COLUMN "status" TYPE public.userstatus
                        USING "status"::text::public.userstatus
                        """
                    )
                )
                print("  ✓ Updated public.auth.status to use public.userstatus")

                # Set default for status column after type conversion
                status_default = conn.execute(
                    sa.text(
                        """
                        SELECT column_default
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'auth'
                          AND column_name = 'status'
                        """
                    )
                ).scalar()

                if not status_default:
                    conn.execute(
                        sa.text('ALTER TABLE public."auth" ALTER COLUMN "status" SET DEFAULT \'ACTIVE\'::userstatus')
                    )
                    print("  ✓ Set default for auth.status to 'ACTIVE'")

    # Step 2f: Drop FK constraints in public_old that reference shared tables
    # Since shared tables (organization, auth, etc.) are now in public schema,
    # and public_old is only used as a data source for tenant migration,
    # we drop these FKs to allow seeding without cross-schema FK issues
    print("\nStep 2f: Dropping FK constraints in public_old referencing shared tables...")

    # List of FK constraints to drop in public_old that reference shared tables
    fk_constraints_to_drop = [
        # All FKs referencing organization.name (now in public schema)
        ("attribute", "attribute_organizationName_fkey"),
        ("auth", "auth_organizationName_fkey"),
        ("chat", "chat_organizationName_fkey"),
        ("chatAssignFilter", "chatAssignFilter_organizationName_fkey"),
        ("chatAssignRule", "chatAssignRule_organizationName_fkey"),
        ("chatReplyMessageTemplate", "chatReplyMessageTemplate_organizationName_fkey"),
        ("chatUserRead", "chatUserRead_organizationName_fkey"),
        ("memberFeedData", "memberFeedData_organizationName_fkey"),
        ("note", "note_organizationName_fkey"),
        ("organizationSettings", "organizationSettings_organizationName_fkey"),
        ("store", "store_organizationName_fkey"),
        ("surveyData", "surveyData_organizationName_fkey"),
        ("tags", "tags_organizationName_fkey"),
        ("team", "team_organizationName_fkey"),
        ("user", "user_organizationName_fkey"),
        # FKs referencing auth.id (now in public schema)
        ("user", "fk_user_auth_id"),  # user.id -> auth.id
        ("userPasswordResetToken", "userPasswordResetToken_userId_fkey"),
    ]

    dropped_count = 0
    for table_name, constraint_name in fk_constraints_to_drop:
        # Check if constraint exists before dropping
        constraint_exists = conn.execute(
            sa.text(
                """
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_schema = 'public_old'
                      AND table_name = :table
                      AND constraint_name = :constraint
                      AND constraint_type = 'FOREIGN KEY'
                )
                """
            ),
            {"table": table_name, "constraint": constraint_name},
        ).scalar()

        if constraint_exists:
            conn.execute(
                sa.text(f'ALTER TABLE public_old."{table_name}" DROP CONSTRAINT IF EXISTS "{constraint_name}"')
            )
            dropped_count += 1

    print(f"  ✓ Dropped {dropped_count} FK constraints in public_old")

    # Step 3: Recreate foreign keys for shared tables
    print("\nStep 3: Recreating foreign keys for shared tables...")

    for table_name in SHARED_TABLES:
        table_check_query2 = (
            "SELECT EXISTS (SELECT FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :table)"
        )
        table_exists = conn.execute(sa.text(table_check_query2), {"table": table_name}).scalar()

        if not table_exists:
            continue

        # Get foreign keys from public_old
        # Note: We use a subquery to properly pair columns with their positions
        fk_query = """
            SELECT DISTINCT
                tc.constraint_name,
                (SELECT string_agg('"' || kcu2.column_name || '"', ', ' ORDER BY kcu2.ordinal_position)
                 FROM information_schema.key_column_usage kcu2
                 WHERE kcu2.constraint_name = tc.constraint_name
                   AND kcu2.table_schema = tc.table_schema) as columns,
                (SELECT ccu2.table_name
                 FROM information_schema.constraint_column_usage ccu2
                 WHERE ccu2.constraint_name = tc.constraint_name
                   AND ccu2.table_schema = tc.table_schema
                 LIMIT 1) as foreign_table_name,
                (SELECT string_agg('"' || ccu2.column_name || '"', ', ')
                 FROM information_schema.constraint_column_usage ccu2
                 WHERE ccu2.constraint_name = tc.constraint_name
                   AND ccu2.table_schema = tc.table_schema) as foreign_columns,
                rc.update_rule,
                rc.delete_rule
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.referential_constraints AS rc
              ON rc.constraint_name = tc.constraint_name
              AND rc.constraint_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public_old'
              AND tc.table_name = :table
        """
        fks = conn.execute(sa.text(fk_query), {"table": table_name}).fetchall()

        for fk_name, columns, ref_table, ref_columns, update_rule, delete_rule in fks:
            # Only recreate FK if referenced table is also a shared table (exists in new public)
            ref_check_query = (
                "SELECT EXISTS (SELECT FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :table)"
            )
            ref_exists = conn.execute(sa.text(ref_check_query), {"table": ref_table}).scalar()

            if not ref_exists:
                print(f"    ⚠ Skipping FK {fk_name} on {table_name} (references {ref_table} not in public)")
                continue

            on_update = f"ON UPDATE {update_rule}" if update_rule != "NO ACTION" else ""
            on_delete = f"ON DELETE {delete_rule}" if delete_rule != "NO ACTION" else ""

            fk_sql = f"""
                ALTER TABLE public."{table_name}"
                ADD CONSTRAINT "{fk_name}"
                FOREIGN KEY ({columns})
                REFERENCES public."{ref_table}" ({ref_columns})
                {on_update} {on_delete}
            """

            try:
                conn.execute(sa.text(fk_sql))
                print(f"    ✓ Created FK: {table_name} → {ref_table}")
            except Exception as e:
                logger.warning(f"Could not create FK {fk_name}: {e}")

    print("\n✓ Migration complete!")
    print("  - public_old: Full backup of original public schema")
    print("  - public: Contains only shared tables (SharedBase)")
    print("  - Tenant tables remain in public_old and should be migrated to tenant schemas")


def downgrade():
    """
    Restore public schema from public_old backup.

    This migration should ONLY run on public schema.
    Tenant schemas will be deleted by env.py on downgrade past this revision.
    """
    schema = op.get_context().version_table_schema or op.get_context().opts.get("x", {}).get("schema", "public")
    is_public = schema == "public"

    if not is_public:
        print(f"Skipping downgrade for tenant schema: {schema} (will be deleted by env.py)")
        return

    conn = op.get_bind()

    # Step 1: Check if public_old exists
    public_old_exists = conn.execute(
        sa.text(f"SELECT EXISTS (SELECT FROM pg_namespace WHERE nspname = '{PUBLIC_OLD_SCHEMA}')")
    ).scalar()

    if not public_old_exists:
        raise Exception(
            f"{PUBLIC_OLD_SCHEMA} schema does not exist. Cannot restore public schema. This likely means the "
            + "migration was not run or the backup was manually deleted."
        )

    print(f"Step 1: Restoring public schema from {PUBLIC_OLD_SCHEMA} backup...")

    # Step 2: Drop current public schema
    conn.execute(sa.text("DROP SCHEMA IF EXISTS public CASCADE"))
    print("  ✓ Dropped current public schema")

    # Step 3: Rename public_old back to public
    conn.execute(sa.text(f"ALTER SCHEMA {PUBLIC_OLD_SCHEMA} RENAME TO public"))
    print(f"  ✓ Renamed {PUBLIC_OLD_SCHEMA} → public")

    # Fix alembic_version: restored public_old has down_revision value, but Alembic
    # expects this migration's revision so it can update to down_revision after this step
    conn.execute(
        sa.text("UPDATE public.alembic_version SET version_num = :rev"),
        {"rev": revision},
    )
    print(f"  ✓ Fixed alembic_version to {revision} (Alembic will update to {down_revision})")

    # NOTE: The upgrade Step 2f dropped FK constraints from public_old to sever cross-schema
    # references (organizationName_fkey, fk_user_auth_id, etc.). We intentionally do NOT
    # restore them here. The public_old schema is the correct pre-migration state, and
    # subsequent downgrades use IF EXISTS on DROP CONSTRAINT calls to handle missing FKs.

    # Step 4: Drop organization.id column
    op.drop_index("ix_organization_id", "organization", schema=schema)
    op.drop_column("organization", "id", schema=schema)
    print("  ✓ Dropped organization.id column")

    # Step 4b: Clean up auth table indexes created during upgrade
    print("  Cleaning up auth table indexes...")
    conn.execute(
        sa.text(
            """
            DROP INDEX IF EXISTS public.ix_auth_organization_name
        """
        )
    )
    print("  ✓ Dropped ix_auth_organization_name index")

    # Step 5: Grant permissions on restored public schema
    current_user = conn.execute(sa.text("SELECT current_user")).scalar()
    conn.execute(sa.text("GRANT ALL ON SCHEMA public TO PUBLIC"))
    # Quote username for Cloud SQL service accounts with special characters
    conn.execute(sa.text(f'GRANT ALL ON SCHEMA public TO "{current_user}"'))
    print(f"  ✓ Granted permissions on public schema (user: {current_user})")

    print("\n✓ Downgrade complete!")
    print("  - public: Restored from backup (contains all original tables)")
    print(f"  - {PUBLIC_OLD_SCHEMA}: Removed (merged back into public)")
