"""fix_deal_folder_user_id_type

Revision ID: f02074f21340
Revises: 1b1429800e1b
Create Date: 2026-01-17 20:05:02.677136

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f02074f21340'
down_revision: Union[str, None] = '1b1429800e1b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop and recreate deal_folders table with correct user_id type
    # This is simpler for SQLite than trying to alter columns

    # Drop the table (this will cascade delete any existing folders)
    op.drop_table('deal_folders')

    # Recreate with correct schema
    op.create_table(
        'deal_folders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),  # Fixed: String instead of Integer
        sa.Column('folder_name', sa.String(), nullable=False),
        sa.Column('property_type', sa.String(), nullable=True),
        sa.Column('property_address', sa.String(), nullable=True),
        sa.Column('submarket', sa.String(), nullable=True),
        sa.Column('total_units', sa.Integer(), nullable=True),
        sa.Column('total_sf', sa.Integer(), nullable=True),
        sa.Column('created_date', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('last_updated', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('document_count', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('status', sa.String(), server_default=sa.text("'active'"), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Recreate index
    op.create_index('ix_deal_folders_user_id_folder_name', 'deal_folders', ['user_id', 'folder_name'])


def downgrade() -> None:
    # Drop and recreate with INTEGER type (destructive)
    op.drop_table('deal_folders')

    op.create_table(
        'deal_folders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),  # Back to Integer
        sa.Column('folder_name', sa.String(), nullable=False),
        sa.Column('property_type', sa.String(), nullable=True),
        sa.Column('property_address', sa.String(), nullable=True),
        sa.Column('submarket', sa.String(), nullable=True),
        sa.Column('total_units', sa.Integer(), nullable=True),
        sa.Column('total_sf', sa.Integer(), nullable=True),
        sa.Column('created_date', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('last_updated', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('document_count', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('status', sa.String(), server_default=sa.text("'active'"), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index('ix_deal_folders_user_id_folder_name', 'deal_folders', ['user_id', 'folder_name'])
