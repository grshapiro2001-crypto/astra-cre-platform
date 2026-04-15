"""add saved_comparisons table

Revision ID: j8e2f0a4b6d7
Revises: i7d1e9f3a5c6
Create Date: 2026-04-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j8e2f0a4b6d7'
down_revision: Union[str, None] = 'i7d1e9f3a5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'saved_comparisons',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('property_ids', sa.JSON(), nullable=False),
        sa.Column('subject_property_id', sa.Integer(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('preset_key', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_saved_comparisons_id'), 'saved_comparisons', ['id'])
    op.create_index(op.f('ix_saved_comparisons_organization_id'), 'saved_comparisons', ['organization_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_saved_comparisons_organization_id'), table_name='saved_comparisons')
    op.drop_index(op.f('ix_saved_comparisons_id'), table_name='saved_comparisons')
    op.drop_table('saved_comparisons')
