"""Add property_sales_comps table for OM/BOV extracted sales comps

Revision ID: c5d7e9f1a3b2
Revises: 88aa82da6101
Create Date: 2026-02-24 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d7e9f1a3b2'
down_revision: Union[str, None] = '88aa82da6101'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('property_sales_comps',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('property_name', sa.String(length=255), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('year_built', sa.Integer(), nullable=True),
        sa.Column('units', sa.Integer(), nullable=True),
        sa.Column('avg_rent', sa.Float(), nullable=True),
        sa.Column('sale_date', sa.String(length=50), nullable=True),
        sa.Column('sale_price', sa.Float(), nullable=True),
        sa.Column('price_per_unit', sa.Float(), nullable=True),
        sa.Column('cap_rate', sa.Float(), nullable=True),
        sa.Column('cap_rate_qualifier', sa.String(length=100), nullable=True),
        sa.Column('buyer', sa.String(length=255), nullable=True),
        sa.Column('seller', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('property_sales_comps')
