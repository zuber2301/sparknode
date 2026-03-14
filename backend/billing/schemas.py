"""Pydantic schemas for the Billing module."""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal


class InvoiceResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    invoice_number: str
    period_start: date
    period_end: date
    billing_cycle: str
    subtotal: Decimal
    discount_pct: Decimal
    discount_amount: Decimal
    total: Decimal
    currency: str
    status: str
    sent_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    line_items: Optional[List[Any]] = None
    pdf_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GenerateInvoiceRequest(BaseModel):
    tenant_id: UUID
    notes: Optional[str] = None
    period_start: Optional[date] = None  # defaults to current month start if omitted


class SendInvoiceRequest(BaseModel):
    pass  # invoice_id comes from the URL path


class UpdateInvoiceStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(pending|sent|paid|overdue|cancelled|void)$")
    notes: Optional[str] = None
