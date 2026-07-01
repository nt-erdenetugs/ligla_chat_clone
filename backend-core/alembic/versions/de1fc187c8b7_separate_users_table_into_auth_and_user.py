"""separate users table into auth and user

Revision ID: de1fc187c8b7
Revises: 6359e4ab5b3b
Create Date: 2026-01-14 15:17:19.952187

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import text

from app.db.migration_constants import PUBLIC_SCHEMA

# revision identifiers, used by Alembic.
revision = "de1fc187c8b7"
down_revision = "6359e4ab5b3b"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    schema = op.get_context().version_table_schema or op.get_context().opts.get("x", {}).get("schema", PUBLIC_SCHEMA)
    is_public = schema == PUBLIC_SCHEMA

    # Step 1: create auth table
    op.create_table(
        "auth",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organizationName", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashedPassword", sa.String(), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "ACTIVE", "INACTIVE", "PENDING", "LOCKED", name="userstatus", schema="public", create_type=False
            ),
            server_default=text("'ACTIVE'::userstatus"),
            nullable=False,
        ),
        sa.Column("mailSentAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("loginAttempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("updatedAt", sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["organizationName"],
            ["organization.name"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    if is_public:
        # Step 2: populate auth table with existing user data (preserve status, mailSentAt, loginAttempts)
        op.execute(
            text(
                """
            INSERT INTO public.auth("id", "organizationName", "email", "hashedPassword", "status", "mailSentAt", "loginAttempts")
            SELECT id, "organizationName", "email", "hashedPassword",
                   COALESCE("status", 'ACTIVE'::userstatus), "mailSentAt", COALESCE("loginAttempts", 0)
            FROM public.user
        """
            )
        )

        # Step 3: row count validation
        def get_count(table: str):
            query = text(f"SELECT COUNT(*) from {table}")
            return connection.execute(query).scalar()

        auth_rows = get_count("public.auth")
        user_rows = get_count("public.user")

        if auth_rows != user_rows:
            raise Exception(f"row count validation failed found {user_rows} users and {auth_rows} auths")

        def get_checksum(table: str):
            query = text(
                f"""
                SELECT SUM(hashtext(concat(id, "organizationName", email, "hashedPassword", COALESCE("status"::text, ''), COALESCE("loginAttempts"::text, ''))))
                FROM {table}
            """
            )
            return connection.execute(query).scalar()

        # Step 4: Check sum validation
        auth_check_sum = get_checksum("public.auth")
        user_check_sum = get_checksum("public.user")

        if auth_check_sum != user_check_sum:
            raise Exception(f"Data integrity check failed: Source(auth: {auth_check_sum} != user: {user_check_sum})")

        # Step 5: Create indexes
        op.create_index(op.f("ix_auth_id"), "auth", ["id"], unique=False)
        op.execute(text("CREATE INDEX IF NOT EXISTS ix_auth_email_lower ON public.auth (LOWER(email))"))
        op.execute(
            text('CREATE INDEX IF NOT EXISTS ix_hypervisorUser_email_lower ON public."hypervisorUser" (LOWER(email))')
        )

    # Step 6: Create user
    op.drop_index(op.f("ix_user_id"), table_name="user")
    op.drop_constraint(op.f("user_email_key"), "user", type_="unique")
    op.drop_column("user", "hashedPassword")
    op.drop_column("user", "email")
    op.drop_column("user", "mailSentAt")
    op.drop_column("user", "status")
    op.drop_column("user", "loginAttempts")
    op.drop_constraint(op.f("userPasswordResetToken_userId_fkey"), "userPasswordResetToken", type_="foreignkey")

    if is_public:
        # In public schema: FK to public.auth
        op.create_foreign_key("fk_user_auth_id", "user", "auth", ["id"], ["id"])
        op.create_foreign_key("fk_userPasswordResetToken_userId", "userPasswordResetToken", "auth", ["userId"], ["id"])
    else:
        # In tenant schemas: cross-schema FK to public.auth
        # Use raw SQL to create cross-schema FK
        connection.execute(
            text(
                f"""
            ALTER TABLE "{schema}"."user"
            ADD CONSTRAINT "fk_user_auth_id"
            FOREIGN KEY ("id")
            REFERENCES "public"."auth" ("id")
        """
            )
        )


def downgrade():
    """
    Standard downgrade: reverse auth table split back into user table.
    Tenant schemas will be deleted by env.py on downgrade past this revision.
    """
    schema = op.get_context().version_table_schema or op.get_context().opts.get("x", {}).get("schema", PUBLIC_SCHEMA)
    is_public = schema == PUBLIC_SCHEMA
    conn = op.get_bind()

    if not is_public:
        # Tenant schema downgrade: just drop the FK to auth
        print(f"Downgrading tenant schema {schema}: dropping cross-schema FK to auth")
        conn.execute(text(f'ALTER TABLE "{schema}"."user" DROP CONSTRAINT IF EXISTS "fk_user_auth_id"'))
        return

    # Public schema downgrade: merge auth back into user
    print("Downgrading public schema: merging auth back into user table")

    # Step 1: Add columns back to user table
    op.add_column("user", sa.Column("hashedPassword", sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column("user", sa.Column("email", sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column(
        "user",
        sa.Column(
            "status",
            postgresql.ENUM(
                "ACTIVE", "INACTIVE", "PENDING", "LOCKED", name="userstatus", schema="public", create_type=False
            ),
            server_default=sa.text("'ACTIVE'::userstatus"),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "user",
        sa.Column("loginAttempts", sa.INTEGER(), server_default=sa.text("0"), autoincrement=False, nullable=True),
    )
    op.add_column(
        "user", sa.Column("mailSentAt", postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True)
    )

    # Step 2: Restore userPasswordResetToken FK to user
    conn.execute(
        text('ALTER TABLE public."userPasswordResetToken" DROP CONSTRAINT IF EXISTS "fk_userPasswordResetToken_userId"')
    )
    op.create_foreign_key(
        op.f("userPasswordResetToken_userId_fkey"), "userPasswordResetToken", "user", ["userId"], ["id"]
    )

    # Step 3: Restore data from auth to user
    op.execute(
        """
        UPDATE public.user
        SET "hashedPassword" = a."hashedPassword",
            "email" = a.email,
            "loginAttempts" = a."loginAttempts",
            "status" = a."status",
            "mailSentAt" = a."mailSentAt"
        FROM public.auth a
        WHERE public.user.id = a.id
    """
    )

    # Step 4: Make columns not nullable
    op.alter_column("user", "hashedPassword", nullable=False)
    op.alter_column("user", "organizationName", nullable=False)
    op.alter_column("user", "email", nullable=False)
    op.alter_column("user", "status", nullable=False)
    op.alter_column("user", "loginAttempts", nullable=False)

    # Step 5: Drop FK from user to auth
    conn.execute(text('ALTER TABLE public."user" DROP CONSTRAINT IF EXISTS "fk_user_auth_id"'))

    # Step 6: Restore unique constraint and index on user
    op.create_unique_constraint(op.f("user_email_key"), "user", ["email"])
    op.create_index(op.f("ix_user_id"), "user", ["id"], unique=False)

    # Step 7: Drop auth table
    op.execute(text("DROP INDEX IF EXISTS ix_auth_email_lower"))
    op.execute(text("DROP INDEX IF EXISTS ix_hypervisorUser_email_lower"))
    op.drop_index(op.f("ix_auth_id"), table_name="auth")
    op.drop_table("auth")
