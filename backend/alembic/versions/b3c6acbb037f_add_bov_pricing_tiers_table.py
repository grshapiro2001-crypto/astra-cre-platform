"""add_bov_pricing_tiers_table

Revision ID: b3c6acbb037f
Revises: 8b908e3ac60a
Create Date: 2026-01-17 19:03:22.542618

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c6acbb037f'
down_revision: Union[str, None] = '8b908e3ac60a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create bov_pricing_tiers table
    op.create_table(
        'bov_pricing_tiers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('pricing_tier_id', sa.String(), nullable=False),  # "tier_1", "tier_2", etc.
        sa.Column('tier_label', sa.String(), nullable=True),  # "Premium Pricing", "Market Assumptions", etc.
        sa.Column('tier_type', sa.String(), nullable=True),  # "market_assumption", "asking_price", or NULL

        # Pricing fields
        sa.Column('pricing', sa.Integer(), nullable=True),  # Valuation for this tier
        sa.Column('price_per_unit', sa.Integer(), nullable=True),
        sa.Column('price_per_sf', sa.Numeric(), nullable=True),

        # Loan assumptions
        sa.Column('leverage', sa.Numeric(), nullable=True),  # LTV %
        sa.Column('loan_amount', sa.Integer(), nullable=True),
        sa.Column('interest_rate', sa.Numeric(), nullable=True),  # 5.25
        sa.Column('io_period_months', sa.Integer(), nullable=True),
        sa.Column('amortization_years', sa.Integer(), nullable=True),

        # Return metrics
        sa.Column('unlevered_irr', sa.Numeric(), nullable=True),
        sa.Column('levered_irr', sa.Numeric(), nullable=True),
        sa.Column('equity_multiple', sa.Numeric(), nullable=True),
        sa.Column('avg_cash_on_cash', sa.Numeric(), nullable=True),

        # Terminal assumptions
        sa.Column('terminal_cap_rate', sa.Numeric(), nullable=True),
        sa.Column('hold_period_years', sa.Integer(), nullable=True),

        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create index on (property_id, pricing_tier_id) for fast lookups
    op.create_index('ix_bov_pricing_tiers_property_id_tier_id', 'bov_pricing_tiers', ['property_id', 'pricing_tier_id'])


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_bov_pricing_tiers_property_id_tier_id', table_name='bov_pricing_tiers')

    # Drop table
    op.drop_table('bov_pricing_tiers')
