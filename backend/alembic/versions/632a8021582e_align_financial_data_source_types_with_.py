"""align_financial_data_source_types_with_prod

Revision ID: 632a8021582e
Revises: l0a4b8c2d6e9
Create Date: 2026-05-13 02:23:24.392019

Aligns financial_data_source and financial_data_updated_at column types with
production state observed 2026-05-12 (text + timestamp without time zone).
The columns were originally added by migration 88aa82da6101 as varchar(50) +
timestamptz, but production appears to have been altered out-of-band. This
migration brings the model and any dev/staging DBs into agreement.

Idempotent on Postgres — checks information_schema for current types and only
ALTERs when a mismatch is detected. On production this is a no-op.

On SQLite (used by some local dev DBs), information_schema does not exist and
the lookup returns no rows; the migration becomes a no-op there as well, which
is acceptable because SQLite is type-permissive and stores both column types
identically.

See:
- docs/audits/extraction-methodology-audit.md
- Sprint 1 PR #172
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '632a8021582e'
down_revision: Union[str, None] = 'l0a4b8c2d6e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _existing_types(conn) -> dict:
    """Return {column_name: data_type} for the two target columns. Empty dict on non-Postgres backends or when the columns are absent."""
    try:
        result = conn.execute(sa.text(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_name = 'properties' "
            "AND column_name IN ('financial_data_source', 'financial_data_updated_at')"
        ))
        return {row[0]: row[1] for row in result}
    except Exception:
        return {}


def upgrade() -> None:
    conn = op.get_bind()
    types = _existing_types(conn)

    if types.get('financial_data_source') and types['financial_data_source'] != 'text':
        op.alter_column(
            'properties', 'financial_data_source',
            type_=sa.Text(),
            existing_nullable=True,
            postgresql_using='financial_data_source::text',
        )

    if (
        types.get('financial_data_updated_at')
        and types['financial_data_updated_at'] != 'timestamp without time zone'
    ):
        op.alter_column(
            'properties', 'financial_data_updated_at',
            type_=sa.DateTime(timezone=False),
            existing_nullable=True,
            postgresql_using="financial_data_updated_at AT TIME ZONE 'UTC'",
        )


def downgrade() -> None:
    op.alter_column(
        'properties', 'financial_data_updated_at',
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using="financial_data_updated_at AT TIME ZONE 'UTC'",
    )
    op.alter_column(
        'properties', 'financial_data_source',
        type_=sa.String(length=50),
        existing_nullable=True,
        postgresql_using='financial_data_source::varchar(50)',
    )
