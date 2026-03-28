"""add enabled_modules to tenants

Revision ID: m1n2o3p4q5r6
Revises: None
Create Date: 2026-03-28

Adds the enabled_modules JSONB column to the tenants table.
This column stores which product modules (sparknode, ignitenode) are
enabled for each tenant.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = 'm1n2o3p4q5r6'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.add_column(
        'tenants',
        sa.Column(
            'enabled_modules',
            JSONB,
            server_default='{"sparknode": true, "ignitenode": false}',
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column('tenants', 'enabled_modules')
