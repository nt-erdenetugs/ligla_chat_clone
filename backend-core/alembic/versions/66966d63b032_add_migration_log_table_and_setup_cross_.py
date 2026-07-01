"""Add migration log table and setup cross schema fks

Revision ID: 66966d63b032
Revises: 4dc6367cdcb4
Create Date: 2026-01-12 15:43:57.316615

"""

from alembic import op
import sqlalchemy as sa

from app.db.cross_schema_fks import CROSS_SCHEMA_FKS

# revision identifiers, used by Alembic.
revision = "66966d63b032"
down_revision = "4dc6367cdcb4"
branch_labels = None
depends_on = None


def upgrade():
    # Get the schema being migrated from the context
    context = op.get_context()
    schema = context.opts.get("version_table_schema", "public")

    if schema == "public":
        # Note: migrationLog table is already created in 4dc6367cdcb4
        # Only create index if it doesn't exist
        op.execute(
            sa.text("""
            CREATE INDEX IF NOT EXISTS idx_migration_log_schema
            ON public."migrationLog" ("schemaName")
        """)
        )
    else:
        # 2. We are in a tenant schema. Apply all cross-schema foreign keys.
        for fk in CROSS_SCHEMA_FKS:
            # We use a POSTGRES-specific "DO" block to make this idempotent
            # and safe even if the constraint already exists.
            fk_name = fk.constraint_name or f"fk_{fk.tenant_table}_{fk.tenant_column}"

            # Use raw SQL for the cross-schema FK to ensure it's applied correctly with schemas
            sql = f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = '{fk_name}'
                    AND table_schema = '{schema}'
                ) THEN
                    ALTER TABLE "{schema}"."{fk.tenant_table}"
                    ADD CONSTRAINT "{fk_name}"
                    FOREIGN KEY ("{fk.tenant_column}")
                    REFERENCES "public"."{fk.public_table}" ("{fk.public_column}");
                END IF;
            END $$;
            """
            op.execute(sa.text(sql))


def downgrade():
    context = op.get_context()
    schema = context.opts.get("version_table_schema", "public")

    if schema == "public":
        # =====================================================================
        # PUBLIC SCHEMA: Drop the migration log index
        # =====================================================================
        print("Downgrading public schema: Dropping migration log index")
        op.execute(
            sa.text("""
            DROP INDEX IF EXISTS public.idx_migration_log_schema
        """)
        )
        print("✓ Dropped migration log index from public schema")

        # Note: migrationLog table itself was created in 4dc6367cdcb4, so we don't drop it here

    else:
        # =====================================================================
        # TENANT SCHEMA: Drop cross-schema foreign keys
        # =====================================================================
        print(f"Downgrading tenant schema '{schema}': Dropping cross-schema foreign keys")

        conn = op.get_bind()
        for fk in CROSS_SCHEMA_FKS:
            fk_name = fk.constraint_name or f"fk_{fk.tenant_table}_{fk.tenant_column}"

            # Use raw SQL to drop the cross-schema FK idempotently
            # Execute directly via connection to bypass schema translation
            sql = f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = '{fk_name}'
                    AND table_schema = '{schema}'
                ) THEN
                    ALTER TABLE "{schema}"."{fk.tenant_table}"
                    DROP CONSTRAINT "{fk_name}";
                    RAISE NOTICE 'Dropped constraint: %', '{fk_name}';
                END IF;
            END $$;
            """
            conn.exec_driver_sql(sql)

        print(f"✓ Dropped cross-schema foreign keys from schema '{schema}'")
