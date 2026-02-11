"""Add pipeline columns to properties

Revision ID: e3f7c9d8a4b2
Revises: d6b3223c85c1
Create Date: 2026-02-11 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3f7c9d8a4b2'
down_revision: Union[str, None] = 'd6b3223c85c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add pipeline columns to properties table
    with op.batch_alter_table('properties') as batch_op:
        batch_op.add_column(sa.Column('pipeline_stage', sa.String(), nullable=False, server_default='screening'))
        batch_op.add_column(sa.Column('pipeline_notes', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('pipeline_updated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Remove pipeline columns from properties table
    with op.batch_alter_table('properties') as batch_op:
        batch_op.drop_column('pipeline_updated_at')
        batch_op.drop_column('pipeline_notes')
        batch_op.drop_column('pipeline_stage')
