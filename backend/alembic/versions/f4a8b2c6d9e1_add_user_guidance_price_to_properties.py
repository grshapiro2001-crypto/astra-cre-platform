"""Add user_guidance_price to properties

Revision ID: f4a8b2c6d9e1
Revises: e3f7c9d8a4b2
Create Date: 2026-02-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4a8b2c6d9e1'
down_revision: Union[str, None] = 'e3f7c9d8a4b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('properties') as batch_op:
        batch_op.add_column(sa.Column('user_guidance_price', sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('properties') as batch_op:
        batch_op.drop_column('user_guidance_price')
