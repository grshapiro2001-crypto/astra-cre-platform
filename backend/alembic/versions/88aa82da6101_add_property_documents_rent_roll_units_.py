"""Add property_documents rent_roll_units t12_financials

Revision ID: 88aa82da6101
Revises: f4a8b2c6d9e1
Create Date: 2026-02-16
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '88aa82da6101'
down_revision: Union[str, None] = 'f4a8b2c6d9e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create property_documents table
    op.create_table('property_documents',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('file_path', sa.Text(), nullable=True),
        sa.Column('file_type', sa.String(10), nullable=False),
        sa.Column('document_category', sa.String(50), nullable=False),
        sa.Column('document_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('analyzed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('extraction_status', sa.String(20), nullable=True),
        sa.Column('extraction_summary', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create rent_roll_units table
    op.create_table('rent_roll_units',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('unit_number', sa.String(20), nullable=True),
        sa.Column('unit_type', sa.String(20), nullable=True),
        sa.Column('sqft', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(100), nullable=True),
        sa.Column('is_occupied', sa.Boolean(), nullable=True),
        sa.Column('resident_name', sa.String(255), nullable=True),
        sa.Column('move_in_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('lease_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('lease_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('market_rent', sa.Float(), nullable=True),
        sa.Column('in_place_rent', sa.Float(), nullable=True),
        sa.Column('charge_details', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['document_id'], ['property_documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create t12_financials table
    op.create_table('t12_financials',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('fiscal_year', sa.Integer(), nullable=True),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('gross_potential_rent', sa.Float(), nullable=True),
        sa.Column('loss_to_lease', sa.Float(), nullable=True),
        sa.Column('concessions', sa.Float(), nullable=True),
        sa.Column('vacancy_loss', sa.Float(), nullable=True),
        sa.Column('bad_debt', sa.Float(), nullable=True),
        sa.Column('net_rental_income', sa.Float(), nullable=True),
        sa.Column('other_income', sa.Float(), nullable=True),
        sa.Column('total_revenue', sa.Float(), nullable=True),
        sa.Column('payroll', sa.Float(), nullable=True),
        sa.Column('utilities', sa.Float(), nullable=True),
        sa.Column('repairs_maintenance', sa.Float(), nullable=True),
        sa.Column('turnover', sa.Float(), nullable=True),
        sa.Column('contract_services', sa.Float(), nullable=True),
        sa.Column('marketing', sa.Float(), nullable=True),
        sa.Column('administrative', sa.Float(), nullable=True),
        sa.Column('management_fee', sa.Float(), nullable=True),
        sa.Column('controllable_expenses', sa.Float(), nullable=True),
        sa.Column('real_estate_taxes', sa.Float(), nullable=True),
        sa.Column('insurance', sa.Float(), nullable=True),
        sa.Column('non_controllable_expenses', sa.Float(), nullable=True),
        sa.Column('total_operating_expenses', sa.Float(), nullable=True),
        sa.Column('net_operating_income', sa.Float(), nullable=True),
        sa.Column('monthly_noi', sa.JSON(), nullable=True),
        sa.Column('monthly_revenue', sa.JSON(), nullable=True),
        sa.Column('monthly_expenses', sa.JSON(), nullable=True),
        sa.Column('line_items', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['document_id'], ['property_documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Add new columns to properties table
    with op.batch_alter_table('properties', schema=None) as batch_op:
        batch_op.add_column(sa.Column('financial_data_source', sa.String(50), nullable=True))
        batch_op.add_column(sa.Column('financial_data_updated_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('rr_total_units', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('rr_occupied_units', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('rr_vacancy_count', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('rr_physical_occupancy_pct', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('rr_avg_market_rent', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('rr_avg_in_place_rent', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('rr_avg_sqft', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('rr_loss_to_lease_pct', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('rr_as_of_date', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('t12_revenue', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('t12_total_expenses', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('t12_gsr', sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('properties', schema=None) as batch_op:
        batch_op.drop_column('t12_gsr')
        batch_op.drop_column('t12_total_expenses')
        batch_op.drop_column('t12_revenue')
        batch_op.drop_column('rr_as_of_date')
        batch_op.drop_column('rr_loss_to_lease_pct')
        batch_op.drop_column('rr_avg_sqft')
        batch_op.drop_column('rr_avg_in_place_rent')
        batch_op.drop_column('rr_avg_market_rent')
        batch_op.drop_column('rr_physical_occupancy_pct')
        batch_op.drop_column('rr_vacancy_count')
        batch_op.drop_column('rr_occupied_units')
        batch_op.drop_column('rr_total_units')
        batch_op.drop_column('financial_data_updated_at')
        batch_op.drop_column('financial_data_source')

    op.drop_table('t12_financials')
    op.drop_table('rent_roll_units')
    op.drop_table('property_documents')
