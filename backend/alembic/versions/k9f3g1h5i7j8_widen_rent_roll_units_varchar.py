"""Widen rent_roll_units varchar columns

Widens unit_number and unit_type from VARCHAR(20) to VARCHAR(50) so real-world
floor-plan codes and bldg-unit identifiers fit. resident_name (already 255) and
status (already 100) are left alone. This migration resolves
psycopg2.errors.StringDataRightTruncation on rent roll ingest.

Revision ID: k9f3g1h5i7j8
Revises: j8e2f0a4b6d7
Create Date: 2026-04-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'k9f3g1h5i7j8'
down_revision: Union[str, None] = 'j8e2f0a4b6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('rent_roll_units') as batch_op:
        batch_op.alter_column(
            'unit_number',
            existing_type=sa.String(length=20),
            type_=sa.String(length=50),
            existing_nullable=True,
        )
        batch_op.alter_column(
            'unit_type',
            existing_type=sa.String(length=20),
            type_=sa.String(length=50),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table('rent_roll_units') as batch_op:
        batch_op.alter_column(
            'unit_type',
            existing_type=sa.String(length=50),
            type_=sa.String(length=20),
            existing_nullable=True,
        )
        batch_op.alter_column(
            'unit_number',
            existing_type=sa.String(length=50),
            type_=sa.String(length=20),
            existing_nullable=True,
        )
