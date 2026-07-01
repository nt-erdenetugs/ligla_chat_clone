"""added-is-delivered

Revision ID: dbb2a66ab3aa
Revises: c5a5a4a88455
Create Date: 2025-02-13 12:12:15.344884

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'dbb2a66ab3aa'
down_revision = 'c5a5a4a88455'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('chatMessage', sa.Column('isDelivered', sa.Boolean(), nullable=True))
    op.execute('UPDATE "chatMessage" SET "isDelivered" = FALSE')
    op.alter_column('chatMessage', 'isDelivered',
                    existing_type=sa.Boolean(),
                    nullable=False)

def downgrade():
    op.drop_column('chatMessage', 'isDelivered')
