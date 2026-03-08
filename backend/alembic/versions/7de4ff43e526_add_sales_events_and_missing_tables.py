"""add_sales_events_and_missing_tables

Revision ID: 7de4ff43e526
Revises:
Create Date: 2026-03-08 12:23:24.580862

Safe migration: only CREATE TABLE for tables that don't exist yet.
No DROP TABLE, no column drops, no constraint modifications on existing tables.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '7de4ff43e526'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = postgresql.UUID(as_uuid=True)

    op.create_table('crm_connectors',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('connector_type', sa.String(100), nullable=False),
        sa.Column('config', postgresql.JSONB, nullable=True, server_default=sa.text("'{}'::jsonb")),
        sa.Column('enabled', sa.Boolean, nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('webhook_logs',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('connector_id', uuid_type, sa.ForeignKey('crm_connectors.id'), nullable=True),
        sa.Column('event_type', sa.String(255), nullable=False),
        sa.Column('payload', postgresql.JSONB, nullable=True),
        sa.Column('response_status', sa.Integer, nullable=True),
        sa.Column('response_body', sa.Text, nullable=True),
        sa.Column('attempted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('invitation_tokens',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('token', sa.String(500), nullable=False, unique=True),
        sa.Column('is_used', sa.Boolean, nullable=True, server_default=sa.text('false')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('used_by_user_id', uuid_type, sa.ForeignKey('users.id'), nullable=True),
    )

    op.create_table('reward_catalog_master',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('brand', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('provider_code', sa.String(255), nullable=True),
        sa.Column('fulfillment_type', sa.String(50), nullable=True),
        sa.Column('min_points', sa.Numeric(15, 2), nullable=False),
        sa.Column('max_points', sa.Numeric(15, 2), nullable=False),
        sa.Column('step_points', sa.Numeric(15, 2), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('terms_conditions', sa.Text, nullable=True),
        sa.Column('validity_days', sa.Integer, nullable=True),
        sa.Column('country_codes', postgresql.JSONB, nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column('tags', postgresql.JSONB, nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column('is_active_global', sa.Boolean, nullable=True, server_default=sa.text('true')),
        sa.Column('source_voucher_id', uuid_type, sa.ForeignKey('vouchers.id'), nullable=True),
        sa.Column('created_by', uuid_type, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('reward_catalog_custom',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('fulfillment_type', sa.String(50), nullable=True),
        sa.Column('points_cost', sa.Numeric(15, 2), nullable=False),
        sa.Column('inventory_count', sa.Integer, nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=True, server_default=sa.text('true')),
        sa.Column('sort_order', sa.Integer, nullable=True),
        sa.Column('terms_conditions', sa.Text, nullable=True),
        sa.Column('created_by', uuid_type, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('reward_catalog_tenant',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('master_item_id', uuid_type, sa.ForeignKey('reward_catalog_master.id', ondelete='CASCADE'), nullable=False),
        sa.Column('is_enabled', sa.Boolean, nullable=True, server_default=sa.text('true')),
        sa.Column('custom_min_points', sa.Numeric(15, 2), nullable=True),
        sa.Column('custom_max_points', sa.Numeric(15, 2), nullable=True),
        sa.Column('custom_step_points', sa.Numeric(15, 2), nullable=True),
        sa.Column('visibility_scope', sa.String(50), nullable=True),
        sa.Column('sort_order', sa.Integer, nullable=True),
        sa.Column('created_by', uuid_type, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.UniqueConstraint('tenant_id', 'master_item_id', name='uq_catalog_tenant_master'),
    )

    op.create_table('budget_allocation_logs',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('admin_id', uuid_type, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('currency', sa.String(10), nullable=True, server_default=sa.text("'USD'")),
        sa.Column('reference_note', sa.Text, nullable=True),
        sa.Column('transaction_type', sa.String(50), nullable=False),
        sa.Column('previous_balance', sa.Numeric(15, 2), nullable=True),
        sa.Column('new_balance', sa.Numeric(15, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('platform_billing_logs',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('admin_id', uuid_type, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('currency', sa.String(10), nullable=True, server_default=sa.text("'USD'")),
        sa.Column('reference_note', sa.Text, nullable=True),
        sa.Column('transaction_type', sa.String(50), nullable=False),
        sa.Column('invoice_number', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('budget_distribution_logs',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('from_user_id', uuid_type, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('to_user_id', uuid_type, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('transaction_type', sa.String(50), nullable=False),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', uuid_type, nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('previous_pool_balance', sa.Numeric(15, 2), nullable=True),
        sa.Column('new_pool_balance', sa.Numeric(15, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('budget_allocation_ledger',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('transaction_type', sa.String(50), nullable=False),
        sa.Column('source_entity_type', sa.String(50), nullable=False),
        sa.Column('source_entity_id', uuid_type, nullable=False),
        sa.Column('target_entity_type', sa.String(50), nullable=True),
        sa.Column('target_entity_id', uuid_type, nullable=True),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('balance_before', sa.Numeric(15, 2), nullable=True),
        sa.Column('balance_after', sa.Numeric(15, 2), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('actor_id', uuid_type, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('tenant_budget_allocations',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('total_allocated_budget', sa.Numeric(15, 2), nullable=False),
        sa.Column('remaining_balance', sa.Numeric(15, 2), nullable=False),
        sa.Column('status', sa.String(50), nullable=True, server_default=sa.text("'active'")),
        sa.Column('allocation_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('allocated_by', uuid_type, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('department_budget_allocations',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('department_id', uuid_type, sa.ForeignKey('departments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_budget_allocation_id', uuid_type, sa.ForeignKey('tenant_budget_allocations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('allocated_budget', sa.Numeric(15, 2), nullable=False),
        sa.Column('distributed_budget', sa.Numeric(15, 2), nullable=False, server_default=sa.text('0')),
        sa.Column('remaining_budget', sa.Numeric(15, 2), nullable=False),
        sa.Column('status', sa.String(50), nullable=True, server_default=sa.text("'active'")),
        sa.Column('allocation_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('allocated_by', uuid_type, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('employee_points_allocations',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('department_budget_allocation_id', uuid_type, sa.ForeignKey('department_budget_allocations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('employee_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('allocated_points', sa.Numeric(15, 2), nullable=False),
        sa.Column('spent_points', sa.Numeric(15, 2), nullable=False, server_default=sa.text('0')),
        sa.Column('status', sa.String(50), nullable=True, server_default=sa.text("'active'")),
        sa.Column('allocation_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('allocated_by', uuid_type, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('sales_events',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('dept_id', uuid_type, sa.ForeignKey('departments.id'), nullable=True),
        sa.Column('eligible_dept_ids', postgresql.JSONB, nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column('eligible_region_ids', postgresql.JSONB, nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column('invited_user_ids', postgresql.JSONB, nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column('invited_dept_ids', postgresql.JSONB, nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column('name', sa.Text, nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('goal_metric', sa.Text, nullable=True),
        sa.Column('goal_value', sa.Integer, nullable=True),
        sa.Column('reward_points', sa.Integer, nullable=True),
        sa.Column('total_budget_cap', sa.Integer, nullable=True),
        sa.Column('distributed_so_far', sa.Integer, nullable=True, server_default=sa.text('0')),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('location', sa.Text, nullable=True),
        sa.Column('status', sa.String(50), nullable=True, server_default=sa.text("'draft'")),
        sa.Column('owner_user_id', uuid_type, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('marketing_owner_id', uuid_type, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('target_registrations', sa.Integer, nullable=True),
        sa.Column('target_pipeline', sa.Numeric(18, 2), nullable=True),
        sa.Column('target_revenue', sa.Numeric(18, 2), nullable=True),
        sa.Column('registration_url', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('event_progress',
        sa.Column('event_id', uuid_type, sa.ForeignKey('sales_events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('current_value', sa.Integer, nullable=True, server_default=sa.text('0')),
        sa.Column('is_rewarded', sa.Boolean, nullable=True, server_default=sa.text('false')),
        sa.PrimaryKeyConstraint('event_id', 'user_id'),
    )

    op.create_table('sales_event_metrics',
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_id', uuid_type, sa.ForeignKey('sales_events.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('registrations', sa.Integer, nullable=True, server_default=sa.text('0')),
        sa.Column('attendees', sa.Integer, nullable=True, server_default=sa.text('0')),
        sa.Column('meetings_booked', sa.Integer, nullable=True, server_default=sa.text('0')),
        sa.Column('opportunities', sa.Integer, nullable=True, server_default=sa.text('0')),
        sa.Column('pipeline_value', sa.Numeric(18, 2), nullable=True, server_default=sa.text('0')),
        sa.Column('revenue_closed', sa.Numeric(18, 2), nullable=True, server_default=sa.text('0')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table('sales_event_registrations',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_id', uuid_type, sa.ForeignKey('sales_events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('full_name', sa.Text, nullable=True),
        sa.Column('company', sa.Text, nullable=True),
        sa.Column('role', sa.String(255), nullable=True),
        sa.Column('status', sa.String(50), nullable=True, server_default=sa.text("'registered'")),
        sa.Column('source_channel', sa.String(50), nullable=True),
        sa.Column('utm_source', sa.String(255), nullable=True),
        sa.Column('utm_campaign', sa.String(255), nullable=True),
        sa.Column('registered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('checked_in_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table('sales_event_leads',
        sa.Column('id', uuid_type, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', uuid_type, sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_id', uuid_type, sa.ForeignKey('sales_events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('registration_id', uuid_type, sa.ForeignKey('sales_event_registrations.id'), nullable=True),
        sa.Column('owner_user_id', uuid_type, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('lead_status', sa.String(50), nullable=True, server_default=sa.text("'new'")),
        sa.Column('qualification_fit', sa.String(50), nullable=True),
        sa.Column('qualification_timing', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('sales_event_leads')
    op.drop_table('sales_event_registrations')
    op.drop_table('sales_event_metrics')
    op.drop_table('event_progress')
    op.drop_table('sales_events')
    op.drop_table('employee_points_allocations')
    op.drop_table('department_budget_allocations')
    op.drop_table('tenant_budget_allocations')
    op.drop_table('budget_allocation_ledger')
    op.drop_table('budget_distribution_logs')
    op.drop_table('platform_billing_logs')
    op.drop_table('budget_allocation_logs')
    op.drop_table('reward_catalog_tenant')
    op.drop_table('reward_catalog_custom')
    op.drop_table('reward_catalog_master')
    op.drop_table('invitation_tokens')
    op.drop_table('webhook_logs')
    op.drop_table('crm_connectors')
