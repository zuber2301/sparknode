"""Add email_otp_tokens table for unified passwordless OTP flow

Revision ID: i4j5k6l7m8n9
Revises: h3i4j5k6l7m8
Create Date: 2026-03-21 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'i4j5k6l7m8n9'
down_revision = 'h3i4j5k6l7m8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'email_otp_tokens',
        sa.Column('id',            postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('email',         sa.String(255), nullable=False),
        sa.Column('tenant_id',     postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('otp_code',      sa.String(6),   nullable=False),
        sa.Column('status',        sa.String(10),  nullable=False, server_default='pending'),
        sa.Column('expires_at',    sa.DateTime(timezone=True), nullable=False),
        sa.Column('attempts_left', sa.Integer(),   nullable=False, server_default='5'),
        sa.Column('created_at',    sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index(
        'ix_email_otp_tokens_email_tenant_pending',
        'email_otp_tokens',
        ['email', 'tenant_id', 'status'],
    )


def downgrade() -> None:
    op.drop_index('ix_email_otp_tokens_email_tenant_pending', table_name='email_otp_tokens')
    op.drop_table('email_otp_tokens')
