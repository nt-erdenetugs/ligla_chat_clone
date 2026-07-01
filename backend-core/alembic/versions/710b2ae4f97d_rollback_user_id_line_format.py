"""rollback_user_id_line_format

Revision ID: 710b2ae4f97d
Revises: 815327c71881
Create Date: 2025-02-28 14:40:55.869451

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '710b2ae4f97d'
down_revision = '815327c71881'
branch_labels = None
depends_on = None

TABLES_AND_COLUMNS = [
    ('userTeam', 'userId'),
    ('userPasswordResetToken', 'userId'),
    ('note', 'userId'),
    ('chatAttributeValue', 'userId'),
    ('chat', 'assignedUserId'),
    ('chatActivity', 'actorId'),
    ('chatActivity', 'oldUserId'),
    ('chatActivity', 'newUserId')
]

def drop_fk_constraints():
    op.drop_constraint('userTeam_userId_fkey', 'userTeam', type_='foreignkey')
    op.drop_constraint('userPasswordResetToken_userId_fkey', 'userPasswordResetToken', type_='foreignkey')
    op.drop_constraint('note_userId_fkey', 'note', type_='foreignkey')
    op.drop_constraint('chatAttributeValue_userId_fkey', 'chatAttributeValue', type_='foreignkey')
    op.drop_constraint('chat_assignedUserId_fkey', 'chat', type_='foreignkey')
    op.drop_constraint('chatActivity_actorId_fkey', 'chatActivity', type_='foreignkey')
    op.drop_constraint('chatActivity_oldUserId_fkey', 'chatActivity', type_='foreignkey')
    op.drop_constraint('chatActivity_newUserId_fkey', 'chatActivity', type_='foreignkey')

def create_fk_constraints():
    op.create_foreign_key('userTeam_userId_fkey', 'userTeam', 'user', ['userId'], ['id'])
    op.create_foreign_key('userPasswordResetToken_userId_fkey', 'userPasswordResetToken', 'user', ['userId'], ['id'])
    op.create_foreign_key('note_userId_fkey', 'note', 'user', ['userId'], ['id'])
    op.create_foreign_key('chatAttributeValue_userId_fkey', 'chatAttributeValue', 'user', ['userId'], ['id'])
    op.create_foreign_key('chat_assignedUserId_fkey', 'chat', 'user', ['assignedUserId'], ['id'])
    op.create_foreign_key('chatActivity_actorId_fkey', 'chatActivity', 'user', ['actorId'], ['id'])
    op.create_foreign_key('chatActivity_oldUserId_fkey', 'chatActivity', 'user', ['oldUserId'], ['id'])
    op.create_foreign_key('chatActivity_newUserId_fkey', 'chatActivity', 'user', ['newUserId'], ['id'])

def upgrade():
    connection = op.get_bind()
    transaction = connection.begin_nested()

    try:
        # Drop foreign key constraints first
        drop_fk_constraints()

        # Drop existing primary key constraint
        op.execute('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_pkey"')

        # Create a function to format string as UUID with validation
        op.execute("""
            CREATE OR REPLACE FUNCTION format_as_uuid(input_str text)
            RETURNS uuid AS $$
            DECLARE
                hex_str text;
                formatted_uuid text;
            BEGIN
                -- Skip if not starting with 'U' or NULL
                IF input_str IS NULL OR input_str NOT LIKE 'U%' THEN
                    RETURN NULL;
                END IF;

                -- Remove 'U' prefix and get the hex string
                hex_str := SUBSTRING(input_str FROM 2);

                -- Take only first 32 characters if longer
                IF length(hex_str) > 32 THEN
                    hex_str := SUBSTRING(hex_str FROM 1 FOR 32);
                END IF;

                -- Pad with zeros if shorter than 32 characters
                hex_str := RPAD(hex_str, 32, '0');

                BEGIN
                    -- Format as UUID
                    formatted_uuid := SUBSTRING(hex_str FROM 1 FOR 8) || '-' ||
                                    SUBSTRING(hex_str FROM 9 FOR 4) || '-' ||
                                    SUBSTRING(hex_str FROM 13 FOR 4) || '-' ||
                                    SUBSTRING(hex_str FROM 17 FOR 4) || '-' ||
                                    SUBSTRING(hex_str FROM 21);

                    -- Validate UUID format
                    RETURN formatted_uuid::uuid;
                EXCEPTION WHEN OTHERS THEN
                    RETURN NULL;
                END;
            END;
            $$ LANGUAGE plpgsql;
        """)

        # First convert user table
        op.execute("""
            UPDATE "user"
            SET id = format_as_uuid(id::text)
            WHERE format_as_uuid(id::text) IS NOT NULL
        """)

        # Change user table type to UUID
        op.execute('ALTER TABLE "user" ALTER COLUMN "id" TYPE UUID USING id::uuid')
        op.execute('ALTER TABLE "user" ADD PRIMARY KEY ("id")')

        # Update and convert other tables
        for table, column in TABLES_AND_COLUMNS:
            # First update the values that can be converted
            op.execute(f"""
                UPDATE "{table}"
                SET "{column}" = format_as_uuid("{column}"::text)
                WHERE format_as_uuid("{column}"::text) IS NOT NULL
            """)

            # Then alter the column type to UUID
            op.execute(f'ALTER TABLE "{table}" ALTER COLUMN "{column}" TYPE UUID USING "{column}"::uuid')

        # Handle chatMessage separately to preserve LINE user IDs
        op.execute("""
            ALTER TABLE "chatMessage" ALTER COLUMN "senderId" TYPE VARCHAR(50)
        """)

        # 1. For operators: Convert LINE user ID format to UUID
        op.execute("""
            UPDATE "chatMessage"
            SET "senderId" = format_as_uuid("senderId")::text
            WHERE "senderType" = 'OPERATOR'
            AND "senderId" LIKE 'U%'
            AND format_as_uuid("senderId") IS NOT NULL;
        """)

        # 2. For end users: Convert UUID format to LINE user ID format (U + UUID without dashes)
        op.execute("""
            UPDATE "chatMessage"
            SET "senderId" = 'U' || REPLACE("senderId", '-', '')
            WHERE "senderType" = 'END_USER'
            AND "senderId" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
        """)

        # Recreate foreign key constraints
        create_fk_constraints()

        transaction.commit()
    except Exception as e:
        transaction.rollback()
        raise e

def downgrade():
    connection = op.get_bind()
    transaction = connection.begin_nested()

    try:
        # Add validation before migration
        op.execute("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM "user"
                    WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                ) THEN
                    RAISE EXCEPTION 'Invalid UUID format found in user table';
                END IF;
            END
            $$;
        """)

        # Drop foreign key constraints first
        drop_fk_constraints()

        # Drop existing primary key constraint from user table
        op.execute('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_pkey"')

        # First change all columns to VARCHAR
        op.execute('ALTER TABLE "user" ALTER COLUMN "id" TYPE VARCHAR(50) USING id::text')

        # Add chatMessage to the list for downgrade operations
        tables_for_downgrade = TABLES_AND_COLUMNS + [('chatMessage', 'senderId')]

        # Change all columns to VARCHAR first
        for table, column in tables_for_downgrade:
            op.execute(f'ALTER TABLE "{table}" ALTER COLUMN "{column}" TYPE VARCHAR(50) USING "{column}"::text')

        # Create a temporary table to store the mapping of old to new IDs
        op.execute("""
            CREATE TEMPORARY TABLE id_mapping AS
            SELECT id as old_id, 'U' || REPLACE(id::text, '-', '') as new_id
            FROM "user"
            WHERE id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
        """)

        # Update user table
        op.execute("""
            UPDATE "user" u
            SET id = m.new_id
            FROM id_mapping m
            WHERE u.id::text = m.old_id::text;
        """)

        # Add primary key back to user table
        op.execute('ALTER TABLE "user" ADD PRIMARY KEY ("id")')

        # Update reference tables using the mapping
        for table, column in tables_for_downgrade:
            if table == 'chatMessage':
                op.execute(f"""
                    UPDATE "{table}" t
                    SET "{column}" = m.new_id
                    FROM id_mapping m
                    WHERE t."{column}"::text = m.old_id::text
                    AND t."{column}"::text ~ '^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{12}}$';
                """)
            else:
                op.execute(f"""
                    UPDATE "{table}" t
                    SET "{column}" = m.new_id
                    FROM id_mapping m
                    WHERE t."{column}"::text = m.old_id::text;
                """)

        # Drop the temporary mapping table
        op.execute("DROP TABLE id_mapping")

        # Recreate foreign key constraints
        create_fk_constraints()

        # Add validation after migration
        op.execute("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM "user"
                    WHERE id !~ '^U[0-9a-f]{8}$' AND id !~ '^U[0-9a-f]{32}$'
                ) THEN
                    RAISE EXCEPTION 'Invalid LINE format found after migration';
                END IF;
            END
            $$;
        """)

        transaction.commit()
    except Exception as e:
        transaction.rollback()
        raise e
