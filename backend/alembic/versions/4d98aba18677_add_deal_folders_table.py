"""add_deal_folders_table

Revision ID: 4d98aba18677
Revises: 7ee835148642
Create Date: 2026-01-17 19:02:25.639417

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d98aba18677'
down_revision: Union[str, None] = '7ee835148642'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create deal_folders table
    op.create_table(
        'deal_folders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('folder_name', sa.String(), nullable=False),

        # Property summary fields (for display optimization)
        sa.Column('property_type', sa.String(), nullable=True),
        sa.Column('property_address', sa.String(), nullable=True),
        sa.Column('submarket', sa.String(), nullable=True),
        sa.Column('total_units', sa.Integer(), nullable=True),
        sa.Column('total_sf', sa.Integer(), nullable=True),

        # Metadata
        sa.Column('created_date', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('last_updated', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('document_count', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('status', sa.String(), server_default=sa.text("'active'"), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),

        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create index on (user_id, folder_name) for fast lookups
    op.create_index('ix_deal_folders_user_id_folder_name', 'deal_folders', ['user_id', 'folder_name'])


def downgrade() -> None:
    # Drop index first
    op.drop_index('ix_deal_folders_user_id_folder_name', table_name='deal_folders')

    # Drop table
    op.drop_table('deal_folders')
