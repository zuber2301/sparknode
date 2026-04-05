"""Add budget_alert_rules and budget_alerts tables

Revision ID: o3p4q5r6s7t8
Revises: n2o3p4q5r6s7
Create Date: 2026-03-31

Adds persistent, configurable budget alert rules and fired-alert tracking:
- budget_alert_rules: threshold configuration per tenant or global
- budget_alerts: fired alert instances with status lifecycle
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'o3p4q5r6s7t8'
down_revision = 'n2o3p4q5r6s7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'budget_alert_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('alert_level', sa.String(20), nullable=False, server_default='warning'),
        sa.Column('threshold_percent', sa.Numeric(5, 2), nullable=False),
        sa.Column('email_recipients', postgresql.JSONB, server_default='[]'),
        sa.Column('notify_in_app', sa.Boolean, server_default='true'),
        sa.Column('notify_email', sa.Boolean, server_default='true'),
        sa.Column('hard_limit', sa.Boolean, server_default='false'),
        sa.Column('cooldown_minutes', sa.Integer, server_default='1440'),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'budget_alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('rule_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('budget_alert_rules.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('alert_level', sa.String(20), nullable=False),
        sa.Column('threshold_percent', sa.Numeric(5, 2), nullable=False),
        sa.Column('remaining_percent', sa.Numeric(5, 2), nullable=False),
        sa.Column('remaining_budget', sa.Numeric(15, 2), nullable=False),
        sa.Column('total_budget', sa.Numeric(15, 2), nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('status', sa.String(20), server_default='active'),
        sa.Column('email_sent', sa.Boolean, server_default='false'),
        sa.Column('notification_created', sa.Boolean, server_default='false'),
        sa.Column('acknowledged_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('triggered_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Index for cooldown deduplication lookups
    op.create_index(
        'ix_budget_alerts_rule_tenant_triggered',
        'budget_alerts',
        ['rule_id', 'tenant_id', 'triggered_at'],
    )

    # Index for active alert queries
    op.create_index(
        'ix_budget_alerts_status',
        'budget_alerts',
        ['status'],
    )


def downgrade() -> None:
    op.drop_index('ix_budget_alerts_status', table_name='budget_alerts')
    op.drop_index('ix_budget_alerts_rule_tenant_triggered', table_name='budget_alerts')
    op.drop_table('budget_alerts')
    op.drop_table('budget_alert_rules')
