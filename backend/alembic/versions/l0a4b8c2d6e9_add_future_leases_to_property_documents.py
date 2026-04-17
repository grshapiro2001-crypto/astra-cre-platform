"""Add future_leases JSONB column to property_documents

Stores pre-leases captured from the Future Residents/Applicants section of
rent roll exports. These are incoming residents who have signed but not yet
moved in; they share unit_numbers with existing Current-section units and
are NOT additional physical units. Persisting them keeps the data available
for rollover / notice-to-commit analytics without polluting unit counts.

Revision ID: l0a4b8c2d6e9
Revises: k9f3g1h5i7j8
Create Date: 2026-04-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'l0a4b8c2d6e9'
down_revision: Union[str, None] = 'k9f3g1h5i7j8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'property_documents',
        sa.Column(
            'future_leases',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column('property_documents', 'future_leases')
