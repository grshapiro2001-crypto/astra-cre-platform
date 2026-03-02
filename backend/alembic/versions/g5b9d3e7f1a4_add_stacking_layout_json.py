"""add stacking_layout_json

Revision ID: g5b9d3e7f1a4
Revises: f4a8b2c6d9e1
Create Date: 2026-03-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g5b9d3e7f1a4'
down_revision: Union[str, None] = 'f4a8b2c6d9e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('properties') as batch_op:
        batch_op.add_column(sa.Column('stacking_layout_json', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('properties') as batch_op:
        batch_op.drop_column('stacking_layout_json')
