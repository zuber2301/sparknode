"""add pulse_surveys and growth_events tables

Revision ID: g2h3i4j5k6l7
Revises: f1g2h3i4j5k6
Create Date: 2026-03-16

Adds:
  - pulse_surveys          — Tenant-scoped engagement/NPS pulse survey campaigns
  - pulse_survey_questions — Questions per survey (rating_5, rating_10, text)
  - pulse_survey_responses — Anonymous employee responses (respondent_hash, no user_id stored)
  - growth_events          — Public-facing event pages for lead capture
  - growth_event_registrations — Leads captured from growth event registration pages
"""
from __future__ import annotations
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "g2h3i4j5k6l7"
down_revision: Union[str, None] = "f1g2h3i4j5k6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── pulse_surveys ─────────────────────────────────────────────────────────
    op.create_table(
        "pulse_surveys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "created_by", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("target_department", sa.String(200), nullable=True),
        sa.Column(
            "status",
            sa.Enum("draft", "active", "closed", name="surveystatus"),
            nullable=False, server_default="active",
        ),
        sa.Column("nps_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
    )
    op.create_index("ix_pulse_surveys_tenant_id", "pulse_surveys", ["tenant_id"])
    op.create_index("ix_pulse_surveys_status",    "pulse_surveys", ["status"])

    # ── pulse_survey_questions ────────────────────────────────────────────────
    op.create_table(
        "pulse_survey_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "survey_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pulse_surveys.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("question_type", sa.String(20), nullable=False, server_default="rating_5"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_psq_survey_id", "pulse_survey_questions", ["survey_id"])

    # ── pulse_survey_responses ────────────────────────────────────────────────
    op.create_table(
        "pulse_survey_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "survey_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pulse_surveys.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "question_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pulse_survey_questions.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "tenant_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("respondent_hash", sa.String(64), nullable=False),
        sa.Column("department", sa.String(200), nullable=True),
        sa.Column("score", sa.Integer, nullable=True),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column(
            "submitted_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
    )
    op.create_index("ix_psr_survey_id",       "pulse_survey_responses", ["survey_id"])
    op.create_index("ix_psr_tenant_id",       "pulse_survey_responses", ["tenant_id"])
    op.create_index("ix_psr_respondent_hash", "pulse_survey_responses", ["respondent_hash"])

    # ── growth_events ─────────────────────────────────────────────────────────
    op.create_table(
        "growth_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True,
        ),
        sa.Column(
            "created_by", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("event_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location", sa.String(300), nullable=True),
        sa.Column("timezone_str", sa.String(60), nullable=True),
        sa.Column(
            "status",
            sa.Enum("draft", "published", "closed", name="growtheventstatus"),
            nullable=False, server_default="draft",
        ),
        sa.Column("registration_schema", postgresql.JSONB, nullable=True),
        sa.Column("max_registrations", sa.Integer, nullable=True),
        sa.Column("banner_url", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=True,
        ),
    )
    op.create_index("ix_growth_events_tenant_id", "growth_events", ["tenant_id"])
    op.create_index("ix_growth_events_slug",      "growth_events", ["slug"])
    op.create_index("ix_growth_events_status",    "growth_events", ["status"])

    # ── growth_event_registrations ────────────────────────────────────────────
    op.create_table(
        "growth_event_registrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "event_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("growth_events.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("company", sa.String(200), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("extra_fields", postgresql.JSONB, nullable=True),
        sa.Column(
            "registered_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.Column("utm_source", sa.String(100), nullable=True),
        sa.Column("utm_medium", sa.String(100), nullable=True),
        sa.Column("utm_campaign", sa.String(100), nullable=True),
        sa.Column("ip_hash", sa.String(64), nullable=True),
    )
    op.create_index("ix_ger_event_id", "growth_event_registrations", ["event_id"])
    op.create_index("ix_ger_email",    "growth_event_registrations", ["email"])


def downgrade() -> None:
    op.drop_index("ix_ger_email",    table_name="growth_event_registrations")
    op.drop_index("ix_ger_event_id", table_name="growth_event_registrations")
    op.drop_table("growth_event_registrations")

    op.drop_index("ix_growth_events_status",    table_name="growth_events")
    op.drop_index("ix_growth_events_slug",      table_name="growth_events")
    op.drop_index("ix_growth_events_tenant_id", table_name="growth_events")
    op.drop_table("growth_events")
    op.execute("DROP TYPE IF EXISTS growtheventstatus")

    op.drop_index("ix_psr_respondent_hash", table_name="pulse_survey_responses")
    op.drop_index("ix_psr_tenant_id",       table_name="pulse_survey_responses")
    op.drop_index("ix_psr_survey_id",       table_name="pulse_survey_responses")
    op.drop_table("pulse_survey_responses")

    op.drop_index("ix_psq_survey_id", table_name="pulse_survey_questions")
    op.drop_table("pulse_survey_questions")

    op.drop_index("ix_pulse_surveys_status",    table_name="pulse_surveys")
    op.drop_index("ix_pulse_surveys_tenant_id", table_name="pulse_surveys")
    op.drop_table("pulse_surveys")
    op.execute("DROP TYPE IF EXISTS surveystatus")
