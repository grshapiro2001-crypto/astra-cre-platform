"""add_deal_scoring_tables

Revision ID: 94f3909b1317
Revises: f02074f21340
Create Date: 2026-02-08 07:10:56.178291

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '94f3909b1317'
down_revision: Union[str, None] = 'f02074f21340'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create user_scoring_weights table
    op.create_table('user_scoring_weights',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('weight_cap_rate', sa.Float(), nullable=False),
        sa.Column('weight_economic_occupancy', sa.Float(), nullable=False),
        sa.Column('weight_loss_to_lease', sa.Float(), nullable=False),
        sa.Column('weight_opex_ratio', sa.Float(), nullable=False),
        sa.Column('preset_name', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_user_scoring_weights_id'), 'user_scoring_weights', ['id'], unique=False)

    # Add market sentiment columns to properties
    op.add_column('properties', sa.Column('market_sentiment_score', sa.Float(), nullable=True))
    op.add_column('properties', sa.Column('market_sentiment_rationale', sa.Text(), nullable=True))
    op.add_column('properties', sa.Column('market_sentiment_updated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('properties', 'market_sentiment_updated_at')
    op.drop_column('properties', 'market_sentiment_rationale')
    op.drop_column('properties', 'market_sentiment_score')
    op.drop_index(op.f('ix_user_scoring_weights_id'), table_name='user_scoring_weights')
    op.drop_table('user_scoring_weights')
