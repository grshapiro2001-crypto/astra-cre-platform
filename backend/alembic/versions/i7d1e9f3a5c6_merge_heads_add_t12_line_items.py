"""merge heads and add t12_line_items table

Revision ID: i7d1e9f3a5c6
Revises: 48227cc781d4, h6c0d4e8f2b5
Create Date: 2026-03-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i7d1e9f3a5c6'
down_revision: Union[str, None] = ('48227cc781d4', 'h6c0d4e8f2b5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        't12_line_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('raw_label', sa.String(), nullable=False),
        sa.Column('gl_code', sa.String(), nullable=True),
        sa.Column('section', sa.String(), nullable=False),
        sa.Column('subsection', sa.String(), nullable=True),
        sa.Column('row_index', sa.Integer(), nullable=False),
        sa.Column('is_subtotal', sa.Boolean(), nullable=True),
        sa.Column('is_section_header', sa.Boolean(), nullable=True),
        sa.Column('monthly_values', sa.Text(), nullable=True),
        sa.Column('annual_total', sa.Float(), nullable=True),
        sa.Column('t1_value', sa.Float(), nullable=True),
        sa.Column('t2_value', sa.Float(), nullable=True),
        sa.Column('t3_value', sa.Float(), nullable=True),
        sa.Column('mapped_category', sa.String(), nullable=True),
        sa.Column('auto_confidence', sa.Float(), nullable=True),
        sa.Column('user_confirmed', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_t12_line_items_property_id'), 't12_line_items', ['property_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_t12_line_items_property_id'), table_name='t12_line_items')
    op.drop_table('t12_line_items')
