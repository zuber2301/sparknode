"""add_sales_campaigns

Revision ID: a3f1c2d4e5b6
Revises: 7de4ff43e526
Create Date: 2026-03-08 16:00:00.000000

Adds the Campaign / Booth Exhibition schema:
  - sales_campaigns          (main campaign record + escrow)
  - campaign_participants    (which reps are assigned to a booth)
  - lead_registrations       (visitors captured at the booth)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a3f1c2d4e5b6'
down_revision: Union[str, None] = '7de4ff43e526'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── sales_campaigns ────────────────────────────────────────────────────
    op.create_table(
        'sales_campaigns',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id'), nullable=False),

        # Identity
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('venue', sa.String(500)),
        sa.Column('campaign_type', sa.String(50), server_default='exhibition'),

        # Timeline
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=False),

        # Reward configuration
        sa.Column('points_per_lead', sa.Numeric(15, 2), nullable=False, server_default='50'),
        sa.Column('max_leads_per_rep', sa.Integer),   # optional daily cap
        sa.Column('total_budget_requested', sa.Numeric(15, 2), nullable=False),

        # Escrow lifecycle
        sa.Column('budget_escrow', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('leads_rewarded', sa.Integer, nullable=False, server_default='0'),
        sa.Column('points_disbursed', sa.Numeric(15, 2), nullable=False, server_default='0'),

        # Status: draft | pending_approval | active | closed | cancelled
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),

        # Approval
        sa.Column('approved_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.Text, nullable=True),

        # Sweep
        sa.Column('swept_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('swept_amount', sa.Numeric(15, 2), nullable=True),

        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_sales_campaigns_tenant_id', 'sales_campaigns', ['tenant_id'])
    op.create_index('ix_sales_campaigns_status', 'sales_campaigns', ['status'])

    # ── campaign_participants ──────────────────────────────────────────────
    op.create_table(
        'campaign_participants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('campaign_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('sales_campaigns.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(50), server_default='rep'),   # rep | lead
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('campaign_id', 'user_id', name='uq_campaign_participant'),
    )
    op.create_index('ix_campaign_participants_campaign_id', 'campaign_participants', ['campaign_id'])

    # ── lead_registrations ────────────────────────────────────────────────
    op.create_table(
        'lead_registrations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('campaign_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('sales_campaigns.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sales_rep_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),

        # Visitor info (PII-lite — store hash for dedup, raw for display)
        sa.Column('visitor_name', sa.String(255)),
        sa.Column('visitor_email', sa.String(255)),
        sa.Column('visitor_phone', sa.String(50)),
        sa.Column('visitor_hash', sa.String(64), nullable=False),  # SHA-256 of normalised email/phone
        sa.Column('interest_level', sa.String(50), server_default='medium'),  # low|medium|high

        # Status: pending | verified | duplicate | rejected
        sa.Column('status', sa.String(50), nullable=False, server_default='verified'),

        # Reward snapshot
        sa.Column('points_awarded', sa.Numeric(15, 2), server_default='0'),

        sa.Column('notes', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),

        # Dedup: one visitor_hash per campaign
        sa.UniqueConstraint('campaign_id', 'visitor_hash', name='uq_lead_visitor_per_campaign'),
    )
    op.create_index('ix_lead_registrations_campaign_id', 'lead_registrations', ['campaign_id'])
    op.create_index('ix_lead_registrations_sales_rep_id', 'lead_registrations', ['sales_rep_id'])


def downgrade() -> None:
    op.drop_table('lead_registrations')
    op.drop_table('campaign_participants')
    op.drop_table('sales_campaigns')
