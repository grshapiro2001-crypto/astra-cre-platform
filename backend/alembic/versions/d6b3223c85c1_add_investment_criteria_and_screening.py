"""Add investment criteria and screening

Revision ID: d6b3223c85c1
Revises: 3ae0abe10a2d
Create Date: 2026-02-11 16:36:49.620695

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd6b3223c85c1'
down_revision: Union[str, None] = '3ae0abe10a2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create user_investment_criteria table
    op.create_table('user_investment_criteria',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('criteria_name', sa.String(), nullable=True),
        sa.Column('min_units', sa.Integer(), nullable=True),
        sa.Column('max_units', sa.Integer(), nullable=True),
        sa.Column('property_types', sa.String(), nullable=True),
        sa.Column('target_markets', sa.String(), nullable=True),
        sa.Column('min_year_built', sa.Integer(), nullable=True),
        sa.Column('min_cap_rate', sa.Float(), nullable=True),
        sa.Column('max_cap_rate', sa.Float(), nullable=True),
        sa.Column('min_economic_occupancy', sa.Float(), nullable=True),
        sa.Column('max_opex_ratio', sa.Float(), nullable=True),
        sa.Column('min_noi', sa.Float(), nullable=True),
        sa.Column('max_price_per_unit', sa.Float(), nullable=True),
        sa.Column('min_deal_score', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_investment_criteria_id'), 'user_investment_criteria', ['id'], unique=False)

    # Add screening columns to properties table
    with op.batch_alter_table('properties') as batch_op:
        batch_op.add_column(sa.Column('screening_verdict', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('screening_score', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('screening_details_json', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('properties') as batch_op:
        batch_op.drop_column('screening_details_json')
        batch_op.drop_column('screening_score')
        batch_op.drop_column('screening_verdict')

    op.drop_index(op.f('ix_user_investment_criteria_id'), table_name='user_investment_criteria')
    op.drop_table('user_investment_criteria')
