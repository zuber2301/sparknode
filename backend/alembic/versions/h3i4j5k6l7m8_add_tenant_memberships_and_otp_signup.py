"""add tenant_memberships table and onboarding_completed column

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2026-03-21

Adds:
  - tenant_memberships  — many-to-many user ↔ tenant membership with explicit role
  - users.onboarding_completed — boolean flag for first-time onboarding wizard
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'h3i4j5k6l7m8'
down_revision = 'g2h3i4j5k6l7'
branch_labels = None
depends_on = None


def upgrade():
    # Add onboarding_completed to users
    op.add_column(
        'users',
        sa.Column('onboarding_completed', sa.Boolean(), nullable=True, server_default='false')
    )

    # Create tenant_memberships table
    op.create_table(
        'tenant_memberships',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='EMPLOYEE'),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_unique_constraint('uq_tenant_memberships', 'tenant_memberships', ['tenant_id', 'user_id'])
    op.create_index('ix_tenant_memberships_user_id', 'tenant_memberships', ['user_id'])
    op.create_index('ix_tenant_memberships_tenant_id', 'tenant_memberships', ['tenant_id'])


def downgrade():
    op.drop_index('ix_tenant_memberships_tenant_id', 'tenant_memberships')
    op.drop_index('ix_tenant_memberships_user_id', 'tenant_memberships')
    op.drop_constraint('uq_tenant_memberships', 'tenant_memberships')
    op.drop_table('tenant_memberships')
    op.drop_column('users', 'onboarding_completed')
