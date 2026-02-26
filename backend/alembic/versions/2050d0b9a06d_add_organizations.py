"""add_organizations

Revision ID: 2050d0b9a06d
Revises: c5d7e9f1a3b2
Create Date: 2026-02-26 20:13:34.732729

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2050d0b9a06d'
down_revision: Union[str, None] = 'c5d7e9f1a3b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create organizations table
    op.create_table('organizations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('invite_code', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invite_code')
    )
    op.create_index(op.f('ix_organizations_id'), 'organizations', ['id'], unique=False)

    # Create organization_members table
    op.create_table('organization_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('role', sa.Enum('owner', 'member', name='orgrole'), nullable=False),
        sa.Column('status', sa.Enum('pending', 'approved', name='orgmemberstatus'), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_organization_members_id'), 'organization_members', ['id'], unique=False)

    # Add organization_id to properties
    op.add_column('properties', sa.Column('organization_id', sa.Integer(), nullable=True))

    # Add organization_id to deal_folders
    op.add_column('deal_folders', sa.Column('organization_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('deal_folders', 'organization_id')
    op.drop_column('properties', 'organization_id')
    op.drop_index(op.f('ix_organization_members_id'), table_name='organization_members')
    op.drop_table('organization_members')
    op.drop_index(op.f('ix_organizations_id'), table_name='organizations')
    op.drop_table('organizations')
