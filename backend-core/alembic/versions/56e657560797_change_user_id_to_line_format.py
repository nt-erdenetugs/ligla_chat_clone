"""change_user_id_to_line_format

Revision ID: 56e657560797
Revises: dbb2a66ab3aa
Create Date: 2025-02-14 20:15:50.934637

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '56e657560797'
down_revision = 'dbb2a66ab3aa'
branch_labels = None
depends_on = None

def transform_uuid_to_line_format(uuid_str):
    """
    Transform UUID to LINE format
    Example: converts "123e4567-e89b-12d3-a456-426614174000" to "U123e4567"
    """
    return f"U{uuid_str.split('-')[0]}"

def upgrade():
    # Add transaction management
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
        op.drop_constraint('userTeam_userId_fkey', 'userTeam', type_='foreignkey')
        op.drop_constraint('userPasswordResetToken_userId_fkey', 'userPasswordResetToken', type_='foreignkey')
        op.drop_constraint('note_userId_fkey', 'note', type_='foreignkey')
        op.drop_constraint('chatAttributeValue_userId_fkey', 'chatAttributeValue', type_='foreignkey')
        op.drop_constraint('chat_assignedUserId_fkey', 'chat', type_='foreignkey')
        op.drop_constraint('chatActivity_actorId_fkey', 'chatActivity', type_='foreignkey')
        op.drop_constraint('chatActivity_oldUserId_fkey', 'chatActivity', type_='foreignkey')
        op.drop_constraint('chatActivity_newUserId_fkey', 'chatActivity', type_='foreignkey')

        # Drop existing primary key constraint from user table
        op.execute('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_pkey"')

        # First change all columns to VARCHAR
        op.execute('ALTER TABLE "user" ALTER COLUMN "id" TYPE VARCHAR(50) USING id::text')

        tables_and_columns = [
            ('userTeam', 'userId'),
            ('userPasswordResetToken', 'userId'),
            ('note', 'userId'),
            ('chatAttributeValue', 'userId'),
            ('chat', 'assignedUserId'),
            ('chatActivity', 'actorId'),
            ('chatActivity', 'oldUserId'),
            ('chatActivity', 'newUserId'),
            ('chatMessage', 'senderId'),
        ]

        # Change all columns to VARCHAR first
        for table, column in tables_and_columns:
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
        for table, column in tables_and_columns:
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
        op.create_foreign_key('userTeam_userId_fkey', 'userTeam', 'user', ['userId'], ['id'])
        op.create_foreign_key('userPasswordResetToken_userId_fkey', 'userPasswordResetToken', 'user', ['userId'], ['id'])
        op.create_foreign_key('note_userId_fkey', 'note', 'user', ['userId'], ['id'])
        op.create_foreign_key('chatAttributeValue_userId_fkey', 'chatAttributeValue', 'user', ['userId'], ['id'])
        op.create_foreign_key('chat_assignedUserId_fkey', 'chat', 'user', ['assignedUserId'], ['id'])
        op.create_foreign_key('chatActivity_actorId_fkey', 'chatActivity', 'user', ['actorId'], ['id'])
        op.create_foreign_key('chatActivity_oldUserId_fkey', 'chatActivity', 'user', ['oldUserId'], ['id'])
        op.create_foreign_key('chatActivity_newUserId_fkey', 'chatActivity', 'user', ['newUserId'], ['id'])

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

def downgrade():
    # Drop foreign key constraints first
    op.drop_constraint('userTeam_userId_fkey', 'userTeam', type_='foreignkey')
    op.drop_constraint('userPasswordResetToken_userId_fkey', 'userPasswordResetToken', type_='foreignkey')
    op.drop_constraint('note_userId_fkey', 'note', type_='foreignkey')
    op.drop_constraint('chatAttributeValue_userId_fkey', 'chatAttributeValue', type_='foreignkey')
    op.drop_constraint('chat_assignedUserId_fkey', 'chat', type_='foreignkey')
    op.drop_constraint('chatActivity_actorId_fkey', 'chatActivity', type_='foreignkey')
    op.drop_constraint('chatActivity_oldUserId_fkey', 'chatActivity', type_='foreignkey')
    op.drop_constraint('chatActivity_newUserId_fkey', 'chatActivity', type_='foreignkey')

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

    # First handle the chatMessage table separately
    op.execute("""
        CREATE TEMPORARY TABLE tmp_chat_message AS
        SELECT id, "senderId", "senderType"
        FROM "chatMessage"
        WHERE "senderType" = 'OPERATOR';
    """)

    # Update tables with UUID format, skipping invalid UUIDs
    tables_and_columns = [
        ('userTeam', 'userId'),
        ('userPasswordResetToken', 'userId'),
        ('note', 'userId'),
        ('chatAttributeValue', 'userId'),
        ('chat', 'assignedUserId'),
        ('chatActivity', 'actorId'),
        ('chatActivity', 'oldUserId'),
        ('chatActivity', 'newUserId')
    ]

    # First convert user table
    op.execute("""
        UPDATE "user"
        SET id = format_as_uuid(id)
        WHERE format_as_uuid(id) IS NOT NULL
    """)

    # Change user table type to UUID
    op.execute('ALTER TABLE "user" ALTER COLUMN "id" TYPE UUID USING id::uuid')
    op.execute('ALTER TABLE "user" ADD PRIMARY KEY ("id")')

    # Update and convert other tables
    for table, column in tables_and_columns:
        # First update the values that can be converted
        op.execute(f"""
            UPDATE "{table}"
            SET "{column}" = format_as_uuid("{column}")
            WHERE format_as_uuid("{column}") IS NOT NULL
        """)

        # Then alter the column type to UUID
        op.execute(f'ALTER TABLE "{table}" ALTER COLUMN "{column}" TYPE UUID USING "{column}"::uuid')

    # Handle chatMessage separately to preserve LINE user IDs
    op.execute("""
        ALTER TABLE "chatMessage" ALTER COLUMN "senderId" TYPE VARCHAR(50)
    """)

    # Update only UUID-format senderIds to full UUID format
    op.execute("""
        UPDATE "chatMessage"
        SET "senderId" = format_as_uuid("senderId")::text
        WHERE id::text !~ '^U[0-9a-f]{8}$'
        AND id::text !~ '^U[0-9a-f]{32}$'
        AND format_as_uuid("senderId") IS NOT NULL;
    """)

    op.execute("DROP TABLE tmp_chat_message")

    # Recreate foreign key constraints
    op.create_foreign_key('userTeam_userId_fkey', 'userTeam', 'user', ['userId'], ['id'])
    op.create_foreign_key('userPasswordResetToken_userId_fkey', 'userPasswordResetToken', 'user', ['userId'], ['id'])
    op.create_foreign_key('note_userId_fkey', 'note', 'user', ['userId'], ['id'])
    op.create_foreign_key('chatAttributeValue_userId_fkey', 'chatAttributeValue', 'user', ['userId'], ['id'])
    op.create_foreign_key('chat_assignedUserId_fkey', 'chat', 'user', ['assignedUserId'], ['id'])
    op.create_foreign_key('chatActivity_actorId_fkey', 'chatActivity', 'user', ['actorId'], ['id'])
    op.create_foreign_key('chatActivity_oldUserId_fkey', 'chatActivity', 'user', ['oldUserId'], ['id'])
    op.create_foreign_key('chatActivity_newUserId_fkey', 'chatActivity', 'user', ['newUserId'], ['id'])
