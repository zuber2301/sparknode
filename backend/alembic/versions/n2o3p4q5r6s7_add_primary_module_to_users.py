"""add primary_module to users

Revision ID: n2o3p4q5r6s7
Revises: m1n2o3p4q5r6
Create Date: 2026-03-28

Adds primary_module VARCHAR(20) column to the users table.
Values: 'sparknode' | 'ignitenode' | NULL (NULL = no preference, show Gateway)

When a tenant has both SparkNode and IgniteNode, this field classifies
each user's "home" module so they land there directly on login instead
of seeing the Gateway chooser every time.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'n2o3p4q5r6s7'
down_revision = 'm1n2o3p4q5r6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'users',
        sa.Column(
            'primary_module',
            sa.String(20),
            nullable=True,
            comment="'sparknode' | 'ignitenode' | NULL — user home module when tenant has both",
        ),
    )


def downgrade():
    op.drop_column('users', 'primary_module')
