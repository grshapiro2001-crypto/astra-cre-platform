"""update_properties_table_for_folders

Revision ID: 8b908e3ac60a
Revises: 4d98aba18677
Create Date: 2026-01-17 19:02:54.957910

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b908e3ac60a'
down_revision: Union[str, None] = '4d98aba18677'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite requires batch mode for adding foreign keys
    with op.batch_alter_table('properties', schema=None) as batch_op:
        # Add deal_folder_id column (nullable, foreign key to deal_folders)
        batch_op.add_column(sa.Column('deal_folder_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_properties_deal_folder_id', 'deal_folders', ['deal_folder_id'], ['id'], ondelete='SET NULL')

        # Add document_subtype column (e.g., "OM", "BOV", "Rent Roll", "T-12")
        batch_op.add_column(sa.Column('document_subtype', sa.String(), nullable=True))

        # Create index on deal_folder_id for fast folder-based queries
        batch_op.create_index('ix_properties_deal_folder_id', ['deal_folder_id'])


def downgrade() -> None:
    # SQLite requires batch mode for dropping foreign keys
    with op.batch_alter_table('properties', schema=None) as batch_op:
        # Drop index
        batch_op.drop_index('ix_properties_deal_folder_id')

        # Drop document_subtype column
        batch_op.drop_column('document_subtype')

        # Drop foreign key and deal_folder_id column
        batch_op.drop_constraint('fk_properties_deal_folder_id', type_='foreignkey')
        batch_op.drop_column('deal_folder_id')
