"""Add market sentiment signals table and market research columns

Revision ID: b7d4e2f8a1c3
Revises: f4a8b2c6d9e1
Create Date: 2026-02-27 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d4e2f8a1c3'
down_revision: Union[str, None] = 'f4a8b2c6d9e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create market_sentiment_signals table
    op.create_table('market_sentiment_signals',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=True),
        sa.Column('signal_type', sa.String(length=100), nullable=False),
        sa.Column('geography_source_label', sa.String(length=255), nullable=True),
        sa.Column('geography_metro', sa.String(length=255), nullable=True),
        sa.Column('geography_submarket', sa.String(length=255), nullable=True),
        sa.Column('direction', sa.String(length=20), nullable=False),
        sa.Column('magnitude', sa.String(length=20), nullable=False),
        sa.Column('time_reference', sa.String(length=100), nullable=True),
        sa.Column('quantitative_value', sa.String(length=255), nullable=True),
        sa.Column('narrative_summary', sa.Text(), nullable=False),
        sa.Column('verbatim_excerpt', sa.String(length=500), nullable=True),
        sa.Column('confidence', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['data_bank_documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_market_sentiment_signals_id'), 'market_sentiment_signals', ['id'], unique=False)
    op.create_index(op.f('ix_market_sentiment_signals_geography_metro'), 'market_sentiment_signals', ['geography_metro'], unique=False)
    op.create_index('ix_market_sentiment_signals_user_id', 'market_sentiment_signals', ['user_id'], unique=False)
    op.create_index('ix_market_sentiment_signals_document_id', 'market_sentiment_signals', ['document_id'], unique=False)

    # Add market research columns to data_bank_documents
    with op.batch_alter_table('data_bank_documents') as batch_op:
        batch_op.add_column(sa.Column('source_firm', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('publication_date', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('geographies_covered', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('signal_count', sa.Integer(), nullable=True, server_default='0'))


def downgrade() -> None:
    # Remove market research columns from data_bank_documents
    with op.batch_alter_table('data_bank_documents') as batch_op:
        batch_op.drop_column('signal_count')
        batch_op.drop_column('geographies_covered')
        batch_op.drop_column('publication_date')
        batch_op.drop_column('source_firm')

    # Drop market_sentiment_signals table
    op.drop_index('ix_market_sentiment_signals_document_id', table_name='market_sentiment_signals')
    op.drop_index('ix_market_sentiment_signals_user_id', table_name='market_sentiment_signals')
    op.drop_index(op.f('ix_market_sentiment_signals_geography_metro'), table_name='market_sentiment_signals')
    op.drop_index(op.f('ix_market_sentiment_signals_id'), table_name='market_sentiment_signals')
    op.drop_table('market_sentiment_signals')
