"""quote token fields added

Revision ID: '736287f1ad58'
Revises: '8539f89b8632'
Create Date: '2025-03-18 12:36:36.475845'

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '736287f1ad58'
down_revision = '8539f89b8632'
branch_labels = None
depends_on = None

VALID_CONTENT_TYPES = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'LOCATION', 'STICKER']

def validate_existing_types():
    """Validate existing type values before conversion"""
    connection = op.get_bind()

    # Check for invalid types
    invalid_types = connection.execute(
        text("""
            SELECT DISTINCT type
            FROM "chatMessage"
            WHERE type IS NOT NULL
            AND UPPER(type) NOT IN :valid_types
        """).bindparams(valid_types=tuple(VALID_CONTENT_TYPES))
    ).fetchall()

    if invalid_types:
        raise Exception(f"Found invalid content types: {invalid_types}. Please fix before migration.")

def upgrade():
    connection = op.get_bind()

    try:
        # 1. Validate existing data
        validate_existing_types()

        # 2. Create enum type first
        content_type = postgresql.ENUM(*VALID_CONTENT_TYPES, name='contenttype')
        content_type.create(connection)

        # 3. Create temporary column for safe conversion
        op.add_column('chatMessage', sa.Column('type_new', content_type, nullable=True))

        # 4. Copy data with COALESCE and UPPER to handle nulls and case
        connection.execute(
            text("""
                UPDATE "chatMessage"
                SET type_new = UPPER(COALESCE(type, 'TEXT'))::contenttype
                WHERE type IS NOT NULL
            """)
        )

        # 5. Add the new columns (can be null initially)
        op.add_column('chatMessage', sa.Column('quoteToken', sa.String(), nullable=True))
        op.add_column('chatMessage', sa.Column('quotedMessageId', sa.String(), nullable=True))

        # 6. Drop old column and rename new one
        op.drop_column('chatMessage', 'type')
        op.alter_column('chatMessage', 'type_new', new_column_name='type',
                       existing_type=content_type,
                       nullable=False,
                       server_default='TEXT')

    except Exception as e:
        raise Exception(f"Migration failed: {str(e)}")

def downgrade():
    connection = op.get_bind()

    try:
        # 1. Create temporary VARCHAR column
        op.add_column('chatMessage', sa.Column('type_old', sa.String(50), nullable=True))

        # 2. Copy data back to VARCHAR
        connection.execute(
            text("""
                UPDATE "chatMessage"
                SET type_old = type::text
            """)
        )

        # 3. Drop enum column and rename VARCHAR back
        op.drop_column('chatMessage', 'type')
        op.alter_column('chatMessage', 'type_old', new_column_name='type',
                       existing_type=sa.String(50),
                       nullable=False,
                       server_default='TEXT')

        # 4. Drop the new columns
        op.drop_column('chatMessage', 'quotedMessageId')
        op.drop_column('chatMessage', 'quoteToken')

        # 5. Drop the enum type (only after all columns using it are gone)
        connection.execute(text("DROP TYPE IF EXISTS contenttype"))

    except Exception as e:
        raise Exception(f"Downgrade failed: {str(e)}")
