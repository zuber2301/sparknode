"""
PDF invoice generator using ReportLab.

Generates a professional invoice PDF and writes it to /tmp/invoices/<invoice_number>.pdf
Returns the file path.
"""
import os
from decimal import Decimal
from datetime import date
from typing import Optional, List, Dict, Any

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

CURRENCY_SYMBOLS = {"INR": "₹", "USD": "$", "EUR": "€"}
INVOICE_DIR = "/tmp/invoices"


def _fmt(amount: Decimal, currency: str) -> str:
    sym = CURRENCY_SYMBOLS.get(currency, currency + " ")
    return f"{sym}{float(amount):,.2f}"


def generate_invoice_pdf(
    invoice_number: str,
    tenant_name: str,
    billing_contact_email: str,
    period_start: date,
    period_end: date,
    billing_cycle: str,
    subtotal: Decimal,
    discount_pct: Decimal,
    discount_amount: Decimal,
    total: Decimal,
    currency: str,
    due_date: Optional[date],
    line_items: Optional[List[Dict[str, Any]]],
    notes: Optional[str] = None,
) -> str:
    """Generate a PDF invoice. Returns the file path."""
    os.makedirs(INVOICE_DIR, exist_ok=True)
    pdf_path = os.path.join(INVOICE_DIR, f"{invoice_number}.pdf")

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    brand_color = colors.HexColor("#4F46E5")  # indigo-600
    light_gray  = colors.HexColor("#F3F4F6")
    mid_gray    = colors.HexColor("#6B7280")
    dark        = colors.HexColor("#111827")

    h1 = ParagraphStyle("h1", fontSize=22, fontName="Helvetica-Bold", textColor=brand_color)
    h2 = ParagraphStyle("h2", fontSize=11, fontName="Helvetica-Bold", textColor=dark)
    body = ParagraphStyle("body", fontSize=9, fontName="Helvetica", textColor=dark, leading=14)
    small = ParagraphStyle("small", fontSize=8, fontName="Helvetica", textColor=mid_gray)
    right_bold = ParagraphStyle("right_bold", fontSize=11, fontName="Helvetica-Bold", textColor=dark, alignment=TA_RIGHT)
    right_small = ParagraphStyle("right_small", fontSize=9, fontName="Helvetica", textColor=mid_gray, alignment=TA_RIGHT)

    elements = []

    # ── Header row ──────────────────────────────────────────────────────────
    header_data = [
        [
            Paragraph("SparkNode", h1),
            Paragraph(f"INVOICE", ParagraphStyle("inv", fontSize=18, fontName="Helvetica-Bold", textColor=mid_gray, alignment=TA_RIGHT)),
        ]
    ]
    header_table = Table(header_data, colWidths=["60%", "40%"])
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    elements.append(header_table)
    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=brand_color))
    elements.append(Spacer(1, 5 * mm))

    # ── Meta row: bill-to + invoice details ─────────────────────────────────
    meta_left = [
        Paragraph("BILL TO", ParagraphStyle("label", fontSize=8, fontName="Helvetica-Bold", textColor=mid_gray)),
        Paragraph(tenant_name, h2),
        Paragraph(billing_contact_email, small),
    ]
    meta_right_rows = [
        ("Invoice #",  invoice_number),
        ("Invoice Date", str(date.today())),
        ("Period",     f"{period_start} – {period_end}"),
        ("Cycle",      billing_cycle.capitalize()),
        ("Due Date",   str(due_date) if due_date else "Upon receipt"),
    ]
    meta_right_text = "".join(
        f'<b>{k}:</b> &nbsp;{v}<br/>'
        for k, v in meta_right_rows
    )
    meta_data = [
        [
            [p for p in meta_left],
            Paragraph(meta_right_text, small),
        ]
    ]
    meta_table = Table([["\n".join([]+[]), Paragraph(meta_right_text, small)]], colWidths=["55%", "45%"])

    # build left cell properly
    from reportlab.platypus import KeepTogether
    left_cell_elements = [
        Paragraph("BILL TO", ParagraphStyle("lbl", fontSize=8, fontName="Helvetica-Bold", textColor=mid_gray)),
        Paragraph(tenant_name, h2),
        Paragraph(billing_contact_email, small),
    ]
    meta_table2 = Table(
        [[left_cell_elements, Paragraph(meta_right_text, small)]],
        colWidths=["55%", "45%"],
    )
    meta_table2.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(meta_table2)
    elements.append(Spacer(1, 8 * mm))

    # ── Line items table ─────────────────────────────────────────────────────
    li_header = ["#", "Description", "Unit Price", "Qty", "Amount"]
    li_rows = [li_header]

    if line_items:
        for i, li in enumerate(line_items, 1):
            li_rows.append([
                str(i),
                li.get("description", ""),
                _fmt(Decimal(str(li.get("unit_price", 0))), currency),
                str(li.get("qty", 1)),
                _fmt(Decimal(str(li.get("amount", 0))), currency),
            ])
    else:
        li_rows.append([
            "1",
            f"SparkNode Platform Subscription — {billing_cycle.capitalize()} ({period_start} to {period_end})",
            _fmt(subtotal, currency),
            "1",
            _fmt(subtotal, currency),
        ])

    col_widths = [10 * mm, None, 35 * mm, 15 * mm, 35 * mm]
    li_table = Table(li_rows, colWidths=col_widths, repeatRows=1)
    li_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0),  brand_color),
        ("TEXTCOLOR",    (0, 0), (-1, 0),  colors.white),
        ("FONTNAME",     (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, 0),  9),
        ("FONTSIZE",     (0, 1), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_gray]),
        ("ALIGN",        (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN",        (3, 0), (3, -1),  "CENTER"),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING",      (0, 0), (-1, -1), 5),
        ("LINEBELOW",    (0, 0), (-1, 0),  0.5, brand_color),
        ("GRID",         (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E7EB")),
    ]))
    elements.append(li_table)
    elements.append(Spacer(1, 6 * mm))

    # ── Totals block ─────────────────────────────────────────────────────────
    totals_rows = []
    totals_rows.append(["", "Subtotal", _fmt(subtotal, currency)])
    if discount_pct and discount_pct > 0:
        totals_rows.append(["", f"Discount ({discount_pct}%)", f"- {_fmt(discount_amount, currency)}"])
    totals_rows.append(["", "TOTAL DUE", _fmt(total, currency)])

    totals_table = Table(totals_rows, colWidths=["45%", "35%", "20%"])
    totals_style = [
        ("ALIGN",    (1, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (1, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (1, -1), (-1, -1), 11),
        ("TEXTCOLOR",(1, -1), (-1, -1), brand_color),
        ("LINEABOVE",(1, -1), (-1, -1), 1, brand_color),
        ("TOPPADDING",(0, 0),(-1, -1), 4),
        ("BOTTOMPADDING",(0, 0),(-1, -1), 4),
        ("LEFTPADDING",(0, 0),(-1,-1), 0),
        ("RIGHTPADDING",(0, 0),(-1,-1), 0),
    ]
    totals_table.setStyle(TableStyle(totals_style))
    elements.append(totals_table)
    elements.append(Spacer(1, 8 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E5E7EB")))
    elements.append(Spacer(1, 4 * mm))

    # ── Footer ───────────────────────────────────────────────────────────────
    if notes:
        elements.append(Paragraph(f"<b>Notes:</b> {notes}", small))
        elements.append(Spacer(1, 3 * mm))

    elements.append(Paragraph(
        "Thank you for your business. Please transfer the amount due by the due date. "
        "For questions, contact billing@sparknode.io",
        small,
    ))

    doc.build(elements)
    return pdf_path
