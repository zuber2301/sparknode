"""add_eee_tables

Revision ID: 2f4a5d4e0ab6
Revises: d1e2f3a4b5c6
Create Date: 2026-03-15 12:46:58.348780

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid

# revision identifiers, used by Alembic.
revision: str = '2f4a5d4e0ab6'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # company_values
    op.create_table(
        'company_values',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', sa.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('emoji', sa.String(10), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # engagement_challenges
    op.create_table(
        'engagement_challenges',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', sa.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('challenge_type', sa.String(50), nullable=True),
        sa.Column('points_reward', sa.Numeric(15, 2), nullable=True),
        sa.Column('badge_icon', sa.String(10), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # challenge_completions
    op.create_table(
        'challenge_completions',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', sa.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('challenge_id', sa.UUID(as_uuid=True), sa.ForeignKey('engagement_challenges.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('points_awarded', sa.Numeric(15, 2), nullable=True),
    )

    # recognition_add_ons
    op.create_table(
        'recognition_add_ons',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', sa.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('recognition_id', sa.UUID(as_uuid=True), sa.ForeignKey('recognitions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('from_user_id', sa.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('points', sa.Numeric(15, 2), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # core_value_tag column on recognitions
    op.add_column('recognitions', sa.Column('core_value_tag', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('recognitions', 'core_value_tag')
    op.drop_table('recognition_add_ons')
    op.drop_table('challenge_completions')
    op.drop_table('engagement_challenges')
    op.drop_table('company_values')
