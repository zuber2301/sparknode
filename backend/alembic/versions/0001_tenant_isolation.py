"""add_tenant_id_to_missing_models_and_constraints

Initial migration to bring the schema in line with true multi-tenant SaaS requirements:

1. Add tenant_id to RecognitionComment, RecognitionReaction,
   SalesEventRegistration, SalesEventLead, SalesEventMetrics
2. Make AuditLog.tenant_id NOT NULL
3. Add unique constraint: (tenant_id, corporate_email) on users
4. Add unique constraint: (tenant_id, name) on departments

Revision ID: 0001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = '0001_tenant_isolation'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── 1. Add tenant_id to recognition_comments ─────────────────────────
    op.add_column('recognition_comments',
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True)
    )
    # Backfill from parent recognition
    op.execute("""
        UPDATE recognition_comments rc
        SET tenant_id = r.tenant_id
        FROM recognitions r
        WHERE rc.recognition_id = r.id
          AND rc.tenant_id IS NULL
    """)
    op.alter_column('recognition_comments', 'tenant_id', nullable=False)

    # ─── 2. Add tenant_id to recognition_reactions ────────────────────────
    op.add_column('recognition_reactions',
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True)
    )
    op.execute("""
        UPDATE recognition_reactions rr
        SET tenant_id = r.tenant_id
        FROM recognitions r
        WHERE rr.recognition_id = r.id
          AND rr.tenant_id IS NULL
    """)
    op.alter_column('recognition_reactions', 'tenant_id', nullable=False)

    # ─── 3. Add tenant_id to sales_event_registrations ────────────────────
    op.add_column('sales_event_registrations',
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True)
    )
    op.execute("""
        UPDATE sales_event_registrations ser
        SET tenant_id = se.tenant_id
        FROM sales_events se
        WHERE ser.event_id = se.id
          AND ser.tenant_id IS NULL
    """)
    op.alter_column('sales_event_registrations', 'tenant_id', nullable=False)

    # ─── 4. Add tenant_id to sales_event_leads ────────────────────────────
    op.add_column('sales_event_leads',
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True)
    )
    op.execute("""
        UPDATE sales_event_leads sel
        SET tenant_id = se.tenant_id
        FROM sales_events se
        WHERE sel.event_id = se.id
          AND sel.tenant_id IS NULL
    """)
    op.alter_column('sales_event_leads', 'tenant_id', nullable=False)

    # ─── 5. Add tenant_id to sales_event_metrics ──────────────────────────
    op.add_column('sales_event_metrics',
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True)
    )
    op.execute("""
        UPDATE sales_event_metrics sem
        SET tenant_id = se.tenant_id
        FROM sales_events se
        WHERE sem.event_id = se.id
          AND sem.tenant_id IS NULL
    """)
    op.alter_column('sales_event_metrics', 'tenant_id', nullable=False)

    # ─── 6. Make audit_log.tenant_id NOT NULL ─────────────────────────────
    # First backfill any NULLs with a zero-UUID sentinel (platform-level actions)
    op.execute("""
        UPDATE audit_log
        SET tenant_id = '00000000-0000-0000-0000-000000000000'
        WHERE tenant_id IS NULL
    """)
    op.alter_column('audit_log', 'tenant_id', nullable=False)

    # ─── 7. Tenant-scoped unique constraints ──────────────────────────────
    op.create_unique_constraint(
        'uq_users_tenant_email',
        'users',
        ['tenant_id', 'corporate_email']
    )
    op.create_unique_constraint(
        'uq_departments_tenant_name',
        'departments',
        ['tenant_id', 'name']
    )


def downgrade() -> None:
    # Remove constraints
    op.drop_constraint('uq_departments_tenant_name', 'departments', type_='unique')
    op.drop_constraint('uq_users_tenant_email', 'users', type_='unique')

    # Make audit_log.tenant_id nullable again
    op.alter_column('audit_log', 'tenant_id', nullable=True)

    # Remove tenant_id columns
    op.drop_column('sales_event_metrics', 'tenant_id')
    op.drop_column('sales_event_leads', 'tenant_id')
    op.drop_column('sales_event_registrations', 'tenant_id')
    op.drop_column('recognition_reactions', 'tenant_id')
    op.drop_column('recognition_comments', 'tenant_id')
