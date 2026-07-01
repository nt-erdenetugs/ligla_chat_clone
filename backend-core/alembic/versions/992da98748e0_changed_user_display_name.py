"""changed user display name

Revision ID: 992da98748e0
Revises: 992da98748e0
Create Date: 2024-12-06 18:19:42.781294

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '992da98748e0'
down_revision = '0ebb750a90ea'
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    has_display_name = 'displayName' in [c['name'] for c in inspector.get_columns('user')]

    if not has_display_name:
        # Add the new displayName column (initially nullable)
        op.add_column('user', sa.Column('displayName', sa.String(), nullable=True))

        # Combine firstName and lastName into displayName
        op.execute("""
            UPDATE "user"
            SET "displayName" = CONCAT(
                COALESCE("firstName", ''),
                CASE
                    WHEN "firstName" IS NOT NULL AND "lastName" IS NOT NULL THEN ' '
                    ELSE ''
                END,
                COALESCE("lastName", '')
            )
            WHERE "firstName" IS NOT NULL OR "lastName" IS NOT NULL
        """)

        # Set default value for any NULL displayNames
        op.execute("""
            UPDATE "user"
            SET "displayName" = 'User'
            WHERE "displayName" IS NULL OR "displayName" = ''
        """)

        # Now make displayName not nullable
        op.alter_column('user', 'displayName', nullable=False)

        # Finally drop the old columns
        op.drop_column('user', 'lastName')
        op.drop_column('user', 'firstName')

def downgrade():
    # Add back the original columns
    op.add_column('user', sa.Column('firstName', sa.VARCHAR(), nullable=True))
    op.add_column('user', sa.Column('lastName', sa.VARCHAR(), nullable=True))

    # Attempt to split displayName back into firstName and lastName
    op.execute("""
        UPDATE "user"
        SET
            "firstName" = SPLIT_PART("displayName", ' ', 1),
            "lastName" = CASE
                WHEN POSITION(' ' IN "displayName") > 0
                THEN SUBSTRING("displayName" FROM POSITION(' ' IN "displayName") + 1)
                ELSE NULL
            END
    """)

    # Drop the displayName column
    op.drop_column('user', 'displayName')
