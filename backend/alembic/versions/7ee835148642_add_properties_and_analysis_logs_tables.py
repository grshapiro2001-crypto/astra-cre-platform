"""add_properties_and_analysis_logs_tables

Revision ID: 7ee835148642
Revises: 50c8d7cd5e61
Create Date: 2026-01-17 11:16:01.363595

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7ee835148642'
down_revision: Union[str, None] = '50c8d7cd5e61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create properties table
    op.create_table(
        'properties',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('deal_name', sa.String(255), nullable=False),
        sa.Column('uploaded_filename', sa.String(255)),
        sa.Column('upload_date', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('document_type', sa.String(50)),

        # Property information
        sa.Column('property_address', sa.Text()),
        sa.Column('property_type', sa.String(100)),
        sa.Column('submarket', sa.String(255)),
        sa.Column('year_built', sa.Integer()),
        sa.Column('total_units', sa.Integer()),
        sa.Column('total_residential_sf', sa.Integer()),
        sa.Column('average_market_rent', sa.Float()),
        sa.Column('average_inplace_rent', sa.Float()),

        # Financials stored as JSON
        sa.Column('t3_financials_json', sa.Text()),
        sa.Column('y1_financials_json', sa.Text()),
        sa.Column('t12_financials_json', sa.Text()),

        # Extracted NOI for sorting/filtering
        sa.Column('t3_noi', sa.Float()),
        sa.Column('y1_noi', sa.Float()),
        sa.Column('t12_noi', sa.Float()),

        # Metadata
        sa.Column('raw_pdf_path', sa.Text()),
        sa.Column('analysis_date', sa.DateTime(timezone=True)),
        sa.Column('last_viewed_date', sa.DateTime(timezone=True)),
        sa.Column('analysis_count', sa.Integer(), default=1),
        sa.Column('last_analyzed_at', sa.DateTime(timezone=True)),
        sa.Column('analysis_model', sa.String(100)),
        sa.Column('analysis_status', sa.String(50)),
        sa.Column('search_text', sa.Text())
    )

    # Create indexes
    op.create_index('idx_user_properties', 'properties', ['user_id', 'property_type', 'upload_date'])
    op.create_index('idx_search', 'properties', ['search_text'])
    op.create_index('idx_noi', 'properties', ['t3_noi', 'y1_noi'])

    # Create analysis_logs table
    op.create_table(
        'analysis_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('property_id', sa.Integer(), sa.ForeignKey('properties.id')),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id')),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('action', sa.String(50)),
        sa.Column('model', sa.String(100)),
        sa.Column('status', sa.String(50)),
        sa.Column('error_message', sa.Text())
    )


def downgrade() -> None:
    op.drop_table('analysis_logs')
    op.drop_index('idx_noi', 'properties')
    op.drop_index('idx_search', 'properties')
    op.drop_index('idx_user_properties', 'properties')
    op.drop_table('properties')
