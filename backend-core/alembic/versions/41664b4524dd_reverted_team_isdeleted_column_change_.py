"""reverted team ‘isDeleted’ column change back to ‘isActive’ for consistency

Revision ID: 41664b4524dd
Revises: 8a70119c31f5
Create Date: 2025-01-03 20:52:55.432414

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '41664b4524dd'
down_revision = '8a70119c31f5'
branch_labels = None
depends_on = None

def upgrade():
    # Check if isActive doesn't exist and isDeleted exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('team')]

    if 'isActive' not in columns and 'isDeleted' in columns:
        # Add new column
        op.add_column('team', sa.Column('isActive', sa.Boolean(), server_default='true', nullable=False))

        # Transfer data with reversed logic
        op.execute('UPDATE team SET "isActive" = NOT "isDeleted"')

        # Drop old column
        op.drop_column('team', 'isDeleted')

def downgrade():
    # Check if isDeleted doesn't exist and isActive exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('team')]

    if 'isDeleted' not in columns and 'isActive' in columns:
        # Add old column back
        op.add_column('team', sa.Column('isDeleted', sa.BOOLEAN(), server_default=sa.text('false'), autoincrement=False, nullable=False))

        # Transfer data back with reversed logic
        op.execute('UPDATE team SET "isDeleted" = NOT "isActive"')

        # Drop new column
        op.drop_column('team', 'isActive')
