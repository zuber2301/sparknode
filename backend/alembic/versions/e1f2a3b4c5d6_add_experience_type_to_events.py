"""Add experience_type to events table

Revision ID: e1f2a3b4c5d6
Revises: d1e2f3a4b5c6
Create Date: 2026-03-15 00:00:00.000000
"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = '2f4a5d4e0ab6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'events',
        sa.Column(
            'experience_type',
            sa.String(20),
            nullable=False,
            server_default='engagement',
        )
    )
    # Add a check constraint so only valid values can be stored
    op.create_check_constraint(
        'ck_events_experience_type',
        'events',
        "experience_type IN ('engagement', 'growth')",
    )


def downgrade() -> None:
    op.drop_constraint('ck_events_experience_type', 'events', type_='check')
    op.drop_column('events', 'experience_type')
