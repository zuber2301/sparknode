"""add snpilot_query_logs table

Revision ID: f1g2h3i4j5k6
Revises: e1f2a3b4c5d6
Create Date: 2026-03-16

Creates snpilot_query_logs for usage-analytics tracking.
Each row is a single successful structured-intent invocation from the frontend.
"""
from __future__ import annotations
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f1g2h3i4j5k6"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "snpilot_query_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("intent_slug", sa.String(80), nullable=False),
        sa.Column("params", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_snpilot_query_logs_tenant_id",   "snpilot_query_logs", ["tenant_id"])
    op.create_index("ix_snpilot_query_logs_intent_slug", "snpilot_query_logs", ["intent_slug"])
    op.create_index("ix_snpilot_query_logs_created_at",  "snpilot_query_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_snpilot_query_logs_created_at",  table_name="snpilot_query_logs")
    op.drop_index("ix_snpilot_query_logs_intent_slug", table_name="snpilot_query_logs")
    op.drop_index("ix_snpilot_query_logs_tenant_id",   table_name="snpilot_query_logs")
    op.drop_table("snpilot_query_logs")
