"""Add metro, renovation, granular financials, unit mix, and rent comps

Revision ID: 3ae0abe10a2d
Revises: a1b2c3d4e5f6
Create Date: 2026-02-10 16:31:22.605899

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ae0abe10a2d'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New tables
    op.create_table('property_rent_comps',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('comp_name', sa.String(), nullable=False),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('num_units', sa.Integer(), nullable=True),
        sa.Column('avg_unit_sf', sa.Integer(), nullable=True),
        sa.Column('in_place_rent', sa.Numeric(), nullable=True),
        sa.Column('in_place_rent_psf', sa.Float(), nullable=True),
        sa.Column('bedroom_type', sa.String(), nullable=True),
        sa.Column('is_new_construction', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('property_unit_mix',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('floorplan_name', sa.String(), nullable=True),
        sa.Column('unit_type', sa.String(), nullable=True),
        sa.Column('bedroom_count', sa.Integer(), nullable=True),
        sa.Column('bathroom_count', sa.Integer(), nullable=True),
        sa.Column('num_units', sa.Integer(), nullable=True),
        sa.Column('unit_sf', sa.Integer(), nullable=True),
        sa.Column('in_place_rent', sa.Numeric(), nullable=True),
        sa.Column('proforma_rent', sa.Numeric(), nullable=True),
        sa.Column('proforma_rent_psf', sa.Float(), nullable=True),
        sa.Column('renovation_premium', sa.Numeric(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # New columns on properties table
    # Geography
    op.add_column('properties', sa.Column('metro', sa.String(), nullable=True))

    # Renovation assumptions
    op.add_column('properties', sa.Column('renovation_cost_per_unit', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('renovation_total_cost', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('renovation_rent_premium', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('renovation_roi_pct', sa.Float(), nullable=True))
    op.add_column('properties', sa.Column('renovation_duration_years', sa.Integer(), nullable=True))
    op.add_column('properties', sa.Column('renovation_stabilized_revenue', sa.Numeric(), nullable=True))

    # Y1 granular financials
    op.add_column('properties', sa.Column('y1_loss_to_lease', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('y1_vacancy_rate_pct', sa.Float(), nullable=True))
    op.add_column('properties', sa.Column('y1_concessions', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('y1_credit_loss', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('y1_net_rental_income', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('y1_utility_reimbursements', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('y1_parking_storage_income', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('y1_other_income', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('y1_management_fee_pct', sa.Float(), nullable=True))
    op.add_column('properties', sa.Column('y1_real_estate_taxes', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('y1_insurance', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('y1_replacement_reserves', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('y1_net_cash_flow', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('y1_expense_ratio_pct', sa.Float(), nullable=True))

    # T12 granular financials
    op.add_column('properties', sa.Column('t12_loss_to_lease', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t12_vacancy_rate_pct', sa.Float(), nullable=True))
    op.add_column('properties', sa.Column('t12_concessions', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t12_credit_loss', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t12_net_rental_income', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t12_utility_reimbursements', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t12_parking_storage_income', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t12_other_income', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t12_management_fee_pct', sa.Float(), nullable=True))
    op.add_column('properties', sa.Column('t12_real_estate_taxes', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t12_insurance', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t12_replacement_reserves', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t12_net_cash_flow', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t12_expense_ratio_pct', sa.Float(), nullable=True))

    # T3 granular financials
    op.add_column('properties', sa.Column('t3_loss_to_lease', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t3_vacancy_rate_pct', sa.Float(), nullable=True))
    op.add_column('properties', sa.Column('t3_concessions', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t3_credit_loss', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t3_net_rental_income', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t3_utility_reimbursements', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t3_parking_storage_income', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t3_other_income', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t3_management_fee_pct', sa.Float(), nullable=True))
    op.add_column('properties', sa.Column('t3_real_estate_taxes', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t3_insurance', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t3_replacement_reserves', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t3_net_cash_flow', sa.Numeric(), nullable=True))
    op.add_column('properties', sa.Column('t3_expense_ratio_pct', sa.Float(), nullable=True))


def downgrade() -> None:
    # Drop new columns from properties
    for col in [
        'metro',
        'renovation_cost_per_unit', 'renovation_total_cost', 'renovation_rent_premium',
        'renovation_roi_pct', 'renovation_duration_years', 'renovation_stabilized_revenue',
        'y1_loss_to_lease', 'y1_vacancy_rate_pct', 'y1_concessions', 'y1_credit_loss',
        'y1_net_rental_income', 'y1_utility_reimbursements', 'y1_parking_storage_income',
        'y1_other_income', 'y1_management_fee_pct', 'y1_real_estate_taxes', 'y1_insurance',
        'y1_replacement_reserves', 'y1_net_cash_flow', 'y1_expense_ratio_pct',
        't12_loss_to_lease', 't12_vacancy_rate_pct', 't12_concessions', 't12_credit_loss',
        't12_net_rental_income', 't12_utility_reimbursements', 't12_parking_storage_income',
        't12_other_income', 't12_management_fee_pct', 't12_real_estate_taxes', 't12_insurance',
        't12_replacement_reserves', 't12_net_cash_flow', 't12_expense_ratio_pct',
        't3_loss_to_lease', 't3_vacancy_rate_pct', 't3_concessions', 't3_credit_loss',
        't3_net_rental_income', 't3_utility_reimbursements', 't3_parking_storage_income',
        't3_other_income', 't3_management_fee_pct', 't3_real_estate_taxes', 't3_insurance',
        't3_replacement_reserves', 't3_net_cash_flow', 't3_expense_ratio_pct',
    ]:
        op.drop_column('properties', col)

    # Drop new tables
    op.drop_table('property_unit_mix')
    op.drop_table('property_rent_comps')
