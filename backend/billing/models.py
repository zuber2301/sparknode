"""Billing module — Invoice ORM model."""
from sqlalchemy import Column, String, Numeric, Date, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import func
from sqlalchemy.orm import relationship
import uuid

from database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id      = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    invoice_number = Column(String(50), nullable=False, unique=True)
    period_start   = Column(Date, nullable=False)
    period_end     = Column(Date, nullable=False)
    billing_cycle  = Column(String(20), nullable=False, default="monthly")
    subtotal       = Column(Numeric(15, 2), nullable=False)
    discount_pct   = Column(Numeric(5, 2), nullable=False, default=0)
    discount_amount= Column(Numeric(15, 2), nullable=False, default=0)
    total          = Column(Numeric(15, 2), nullable=False)
    currency       = Column(String(3), nullable=False, default="INR")
    status         = Column(String(20), nullable=False, default="pending")  # pending|sent|paid|overdue|cancelled|void
    sent_at        = Column(DateTime(timezone=True), nullable=True)
    paid_at        = Column(DateTime(timezone=True), nullable=True)
    due_date       = Column(Date, nullable=True)
    notes          = Column(Text, nullable=True)
    line_items     = Column(JSONB, nullable=True)
    pdf_path       = Column(String(500), nullable=True)
    created_by     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant         = relationship("Tenant")
    creator        = relationship("User", foreign_keys=[created_by])
