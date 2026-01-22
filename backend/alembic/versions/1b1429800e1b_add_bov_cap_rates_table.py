"""add_bov_cap_rates_table

Revision ID: 1b1429800e1b
Revises: b3c6acbb037f
Create Date: 2026-01-17 19:03:47.008839

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1b1429800e1b'
down_revision: Union[str, None] = 'b3c6acbb037f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create bov_cap_rates table
    op.create_table(
        'bov_cap_rates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('pricing_tier_id', sa.Integer(), nullable=False),
        sa.Column('cap_rate_type', sa.String(), nullable=False),  # "trailing", "proforma", "stabilized", etc.
        sa.Column('cap_rate_value', sa.Numeric(), nullable=True),  # 4.75
        sa.Column('noi_basis', sa.Integer(), nullable=True),  # NOI value used for calculation
        sa.Column('qualifier', sa.String(), nullable=True),  # "as-is", "stabilized", etc.

        sa.ForeignKeyConstraint(['pricing_tier_id'], ['bov_pricing_tiers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create index on pricing_tier_id for fast lookups
    op.create_index('ix_bov_cap_rates_pricing_tier_id', 'bov_cap_rates', ['pricing_tier_id'])


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_bov_cap_rates_pricing_tier_id', table_name='bov_cap_rates')

    # Drop table
    op.drop_table('bov_cap_rates')
