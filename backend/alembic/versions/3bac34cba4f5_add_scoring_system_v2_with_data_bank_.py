"""Add scoring system v2 with data bank models

Revision ID: 3bac34cba4f5
Revises: f02074f21340
Create Date: 2026-02-10 01:18:51.213123

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3bac34cba4f5'
down_revision: Union[str, None] = 'f02074f21340'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New tables for scoring system v2
    op.create_table('data_bank_documents',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False),
    sa.Column('file_path', sa.Text(), nullable=False),
    sa.Column('document_type', sa.String(length=50), nullable=False),
    sa.Column('extraction_status', sa.String(length=50), nullable=False),
    sa.Column('extraction_data', sa.Text(), nullable=True),
    sa.Column('record_count', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_data_bank_documents_id'), 'data_bank_documents', ['id'], unique=False)

    op.create_table('submarket_inventory',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('metro', sa.String(length=255), nullable=False),
    sa.Column('submarket', sa.String(length=255), nullable=False),
    sa.Column('total_units', sa.Integer(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_submarket_inventory_id'), 'submarket_inventory', ['id'], unique=False)

    op.create_table('user_scoring_weights',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('economic_occupancy_weight', sa.Integer(), nullable=False),
    sa.Column('opex_ratio_weight', sa.Integer(), nullable=False),
    sa.Column('supply_pipeline_weight', sa.Integer(), nullable=False),
    sa.Column('layer1_weight', sa.Integer(), nullable=False),
    sa.Column('layer2_weight', sa.Integer(), nullable=False),
    sa.Column('layer3_weight', sa.Integer(), nullable=False),
    sa.Column('preset_name', sa.String(length=50), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_user_scoring_weights_id'), 'user_scoring_weights', ['id'], unique=False)

    op.create_table('pipeline_projects',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('document_id', sa.Integer(), nullable=True),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('project_name', sa.String(length=255), nullable=True),
    sa.Column('address', sa.Text(), nullable=True),
    sa.Column('county', sa.String(length=255), nullable=True),
    sa.Column('metro', sa.String(length=255), nullable=True),
    sa.Column('submarket', sa.String(length=255), nullable=True),
    sa.Column('units', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=True),
    sa.Column('developer', sa.String(length=255), nullable=True),
    sa.Column('delivery_quarter', sa.String(length=20), nullable=True),
    sa.Column('start_quarter', sa.String(length=20), nullable=True),
    sa.Column('property_type', sa.String(length=100), nullable=True),
    sa.ForeignKeyConstraint(['document_id'], ['data_bank_documents.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pipeline_projects_id'), 'pipeline_projects', ['id'], unique=False)

    op.create_table('sales_comps',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('document_id', sa.Integer(), nullable=True),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('property_name', sa.String(length=255), nullable=True),
    sa.Column('market', sa.String(length=255), nullable=True),
    sa.Column('metro', sa.String(length=255), nullable=True),
    sa.Column('submarket', sa.String(length=255), nullable=True),
    sa.Column('county', sa.String(length=255), nullable=True),
    sa.Column('state', sa.String(length=50), nullable=True),
    sa.Column('address', sa.Text(), nullable=True),
    sa.Column('property_type', sa.String(length=100), nullable=True),
    sa.Column('sale_date', sa.DateTime(timezone=True), nullable=True),
    sa.Column('year_built', sa.Integer(), nullable=True),
    sa.Column('year_renovated', sa.Integer(), nullable=True),
    sa.Column('units', sa.Integer(), nullable=True),
    sa.Column('avg_unit_sf', sa.Float(), nullable=True),
    sa.Column('avg_eff_rent', sa.Float(), nullable=True),
    sa.Column('sale_price', sa.Float(), nullable=True),
    sa.Column('price_per_unit', sa.Float(), nullable=True),
    sa.Column('price_per_sf', sa.Float(), nullable=True),
    sa.Column('cap_rate', sa.Float(), nullable=True),
    sa.Column('cap_rate_qualifier', sa.String(length=50), nullable=True),
    sa.Column('occupancy', sa.Float(), nullable=True),
    sa.Column('buyer', sa.String(length=255), nullable=True),
    sa.Column('seller', sa.String(length=255), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['document_id'], ['data_bank_documents.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sales_comps_id'), 'sales_comps', ['id'], unique=False)

    # Add market sentiment columns to properties
    op.add_column('properties', sa.Column('market_sentiment_score', sa.Integer(), nullable=True))
    op.add_column('properties', sa.Column('market_sentiment_rationale', sa.Text(), nullable=True))
    op.add_column('properties', sa.Column('market_sentiment_updated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('properties', 'market_sentiment_updated_at')
    op.drop_column('properties', 'market_sentiment_rationale')
    op.drop_column('properties', 'market_sentiment_score')

    op.drop_index(op.f('ix_sales_comps_id'), table_name='sales_comps')
    op.drop_table('sales_comps')
    op.drop_index(op.f('ix_pipeline_projects_id'), table_name='pipeline_projects')
    op.drop_table('pipeline_projects')
    op.drop_index(op.f('ix_user_scoring_weights_id'), table_name='user_scoring_weights')
    op.drop_table('user_scoring_weights')
    op.drop_index(op.f('ix_submarket_inventory_id'), table_name='submarket_inventory')
    op.drop_table('submarket_inventory')
    op.drop_index(op.f('ix_data_bank_documents_id'), table_name='data_bank_documents')
    op.drop_table('data_bank_documents')
