"""
Billing API routes.

Endpoints (all require platform_admin):
  GET    /api/billing/invoices                              list all invoices (optionally filtered)
  GET    /api/billing/tenants/{tenant_id}/invoices          invoices for one tenant
  POST   /api/billing/invoices/generate                     manually generate an invoice
  POST   /api/billing/invoices/{invoice_id}/send            (re)send a pending/overdue invoice
  GET    /api/billing/invoices/{invoice_id}/pdf             stream the PDF
  PATCH  /api/billing/invoices/{invoice_id}/status          update status (paid/void/…)
"""
import logging
import os
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Tenant, User
from core.rbac import get_platform_admin
from billing.models import Invoice
from billing.schemas import (
    InvoiceResponse,
    GenerateInvoiceRequest,
    UpdateInvoiceStatusRequest,
)
from billing.service import create_invoice_for_tenant, send_invoice, get_or_generate_pdf

logger = logging.getLogger(__name__)
router = APIRouter()

SENDABLE_STATUSES = {"pending", "sent", "overdue"}


def _get_invoice_or_404(invoice_id: UUID, db: Session) -> Invoice:
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


# ──────────────────────────────────────────────────────────────────────────────
# List endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/invoices", response_model=List[InvoiceResponse])
async def list_all_invoices(
    status: Optional[str] = Query(None),
    tenant_id: Optional[UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """List invoices across all tenants (platform admin view)."""
    q = db.query(Invoice)
    if status:
        q = q.filter(Invoice.status == status)
    if tenant_id:
        q = q.filter(Invoice.tenant_id == tenant_id)
    return q.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/tenants/{tenant_id}/invoices", response_model=List[InvoiceResponse])
async def list_tenant_invoices(
    tenant_id: UUID,
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """List invoices for a specific tenant."""
    q = db.query(Invoice).filter(Invoice.tenant_id == tenant_id)
    if status:
        q = q.filter(Invoice.status == status)
    return q.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()


# ──────────────────────────────────────────────────────────────────────────────
# Generate / send
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/invoices/generate", response_model=InvoiceResponse, status_code=201)
async def generate_invoice(
    payload: GenerateInvoiceRequest,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Manually generate an invoice for a tenant (defaults to current month)."""
    tenant = db.query(Tenant).filter(Tenant.id == payload.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    try:
        invoice = create_invoice_for_tenant(
            tenant=tenant,
            db=db,
            period_start=payload.period_start,
            send_email=True,
            notes=payload.notes,
            created_by=current_user,
        )
    except Exception as exc:
        logger.error("Invoice generation error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Invoice generation failed: {exc}")

    return invoice


@router.post("/invoices/{invoice_id}/send", response_model=InvoiceResponse)
async def send_invoice_endpoint(
    invoice_id: UUID,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """(Re)send an invoice email. Allowed for pending / sent / overdue invoices."""
    invoice = _get_invoice_or_404(invoice_id, db)
    if invoice.status not in SENDABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot send invoice with status '{invoice.status}'. "
                   f"Allowed statuses: {', '.join(sorted(SENDABLE_STATUSES))}",
        )
    tenant = db.query(Tenant).filter(Tenant.id == invoice.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    send_invoice(invoice=invoice, tenant=tenant, db=db)
    db.refresh(invoice)
    return invoice


# ──────────────────────────────────────────────────────────────────────────────
# PDF
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: UUID,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Stream the invoice PDF. Regenerates it if the file is missing."""
    invoice = _get_invoice_or_404(invoice_id, db)
    tenant = db.query(Tenant).filter(Tenant.id == invoice.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    pdf_path = get_or_generate_pdf(invoice=invoice, tenant=tenant, db=db)
    if not pdf_path or not os.path.exists(pdf_path):
        raise HTTPException(status_code=503, detail="PDF could not be generated. Check server logs.")

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"{invoice.invoice_number}.pdf",
    )


# ──────────────────────────────────────────────────────────────────────────────
# Status management
# ──────────────────────────────────────────────────────────────────────────────

@router.patch("/invoices/{invoice_id}/status", response_model=InvoiceResponse)
async def update_invoice_status(
    invoice_id: UUID,
    payload: UpdateInvoiceStatusRequest,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Update invoice status (e.g. mark as paid, void, cancelled)."""
    invoice = _get_invoice_or_404(invoice_id, db)
    invoice.status = payload.status
    if payload.notes:
        invoice.notes = payload.notes
    if payload.status == "paid":
        from datetime import datetime, timezone
        invoice.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(invoice)
    return invoice
