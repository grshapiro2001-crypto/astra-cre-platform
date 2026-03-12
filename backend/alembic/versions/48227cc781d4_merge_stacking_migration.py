"""merge stacking migration

Revision ID: 48227cc781d4
Revises: 2050d0b9a06d, b7d4e2f8a1c3
Create Date: 2026-03-01 21:55:18.622673

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '48227cc781d4'
down_revision: Union[str, None] = ('2050d0b9a06d', 'b7d4e2f8a1c3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
