"""Add billing/invoice tables and billing fields to tenants

Revision ID: d1e2f3a4b5c6
Revises: c2d3e4f5a6b7
Create Date: 2026-03-14 00:00:00.000000
"""
from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- billing fields on tenants ---
    op.add_column('tenants', sa.Column('billing_cycle', sa.String(20), nullable=True, server_default='monthly'))
    op.add_column('tenants', sa.Column('billing_amount', sa.Numeric(15, 2), nullable=True))
    op.add_column('tenants', sa.Column('billing_discount_pct', sa.Numeric(5, 2), nullable=True, server_default='0'))
    op.add_column('tenants', sa.Column('billing_final_amount', sa.Numeric(15, 2), nullable=True))
    op.add_column('tenants', sa.Column('billing_currency', sa.String(3), nullable=True, server_default='INR'))
    op.add_column('tenants', sa.Column('billing_contact_email', sa.String(255), nullable=True))

    # --- invoices table ---
    op.create_table(
        'invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('invoice_number', sa.String(50), nullable=False, unique=True),
        sa.Column('period_start', sa.Date, nullable=False),
        sa.Column('period_end', sa.Date, nullable=False),
        sa.Column('billing_cycle', sa.String(20), nullable=False, server_default='monthly'),
        sa.Column('subtotal', sa.Numeric(15, 2), nullable=False),
        sa.Column('discount_pct', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('discount_amount', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('total', sa.Numeric(15, 2), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='INR'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        # CHECK status IN ('pending','sent','paid','overdue','cancelled','void')
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('due_date', sa.Date, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('line_items', postgresql.JSONB, nullable=True),  # [{desc, qty, unit_price, amount}]
        sa.Column('pdf_path', sa.String(500), nullable=True),      # filesystem path inside container
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_invoices_tenant_id', 'invoices', ['tenant_id'])
    op.create_index('ix_invoices_status', 'invoices', ['status'])
    op.create_check_constraint(
        'invoices_status_check', 'invoices',
        "status IN ('pending','sent','paid','overdue','cancelled','void')"
    )


def downgrade() -> None:
    op.drop_table('invoices')
    for col in ['billing_contact_email', 'billing_currency', 'billing_final_amount',
                'billing_discount_pct', 'billing_amount', 'billing_cycle']:
        op.drop_column('tenants', col)
