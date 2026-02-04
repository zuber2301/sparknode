"""
Platform Admin - Budget Ledger Export Routes

Export endpoints for:
1. CSV export of budget ledger data
2. PDF export of budget ledger report
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import io
import csv
from decimal import Decimal

from database import get_db
from models import Tenant, Wallet
from auth.utils import get_current_user
from core.rbac import get_platform_admin
from .ledger_routes import (
    get_tenants_with_budgets,
    get_budget_stats,
    get_budget_activity
)

router = APIRouter(prefix="/api/platform/ledger/export", tags=["platform-budget-ledger-export"])


# =====================================================
# CSV EXPORT
# =====================================================

@router.get("/csv")
async def export_ledger_csv(
    time_range: Optional[str] = Query("all", regex="^(all|30days|90days)$"),
    current_user = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Export complete budget ledger to CSV format.
    
    Returns a CSV file with three sheets worth of data:
    1. Summary statistics
    2. Tenant breakdown
    3. Activity log
    """
    
    try:
        # Get all data
        tenants_data = await get_tenants_with_budgets(current_user, db)
        stats_data = await get_budget_stats(time_range, current_user, db)
        activity_data = await get_budget_activity(time_range, current_user, db)
        
        # Create in-memory CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write metadata
        writer.writerow(['Budget Ledger Export'])
        writer.writerow([f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'])
        writer.writerow([f'Time Range: {time_range}'])
        writer.writerow([])
        
        # Write summary statistics
        writer.writerow(['SUMMARY STATISTICS'])
        writer.writerow(['Metric', 'Amount', 'Percentage'])
        writer.writerow(['Total Platform Budget', f"₹{stats_data.total_platform_budget:,.2f}", '100%'])
        writer.writerow(['Unallocated', f"₹{stats_data.unallocated_budget:,.2f}", f"{stats_data.unallocated_percent:.1f}%"])
        writer.writerow(['Allocated', f"₹{stats_data.allocated_budget:,.2f}", f"{stats_data.allocated_percent:.1f}%"])
        writer.writerow(['Delegated', f"₹{stats_data.delegated_budget:,.2f}", f"{stats_data.delegated_percent:.1f}%"])
        writer.writerow(['Spendable', f"₹{stats_data.spendable_budget:,.2f}", f"{stats_data.spendable_percent:.1f}%"])
        writer.writerow(['Total Deployed', f"₹{stats_data.total_deployed:,.2f}", f"{stats_data.deployment_rate:.1f}%"])
        writer.writerow([])
        writer.writerow(['Activity Summary'])
        writer.writerow(['Transaction Type', 'Count', 'Total Amount'])
        writer.writerow(['Allocations', activity_data.allocations_count, f"₹{activity_data.allocations_total:,.2f}"])
        writer.writerow(['Distributions', activity_data.distributions_count, f"₹{activity_data.distributions_total:,.2f}"])
        writer.writerow(['Awards', activity_data.awards_count, f"₹{activity_data.awards_total:,.2f}"])
        writer.writerow(['Clawbacks', activity_data.clawbacks_count, f"₹{activity_data.clawbacks_total:,.2f}"])
        writer.writerow([])
        writer.writerow([])
        
        # Write tenant breakdown
        writer.writerow(['TENANT BREAKDOWN'])
        writer.writerow(['Tenant Name', 'Status', 'Tier', 'Allocated', 'Delegated', 'Spendable', 'Total Active', 'Utilization %'])
        
        for tenant in tenants_data:
            writer.writerow([
                tenant.tenant_name,
                tenant.status,
                tenant.subscription_tier,
                f"₹{float(tenant.budget_allocated):,.2f}",
                f"₹{float(tenant.total_lead_budgets):,.2f}",
                f"₹{float(tenant.total_wallet_balance):,.2f}",
                f"₹{float(tenant.total_active):,.2f}",
                f"{tenant.utilization_percent:.1f}%"
            ])
        
        # Convert to bytes
        output.seek(0)
        csv_bytes = output.getvalue().encode('utf-8')
        
        return StreamingResponse(
            iter([csv_bytes]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=budget_ledger_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export CSV: {str(e)}"
        )


# =====================================================
# JSON EXPORT (Alternative format)
# =====================================================

@router.get("/json")
async def export_ledger_json(
    time_range: Optional[str] = Query("all", regex="^(all|30days|90days)$"),
    current_user = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Export complete budget ledger to JSON format.
    
    Includes summary, activity, and tenant breakdown.
    """
    
    try:
        from fastapi.responses import JSONResponse
        
        # Get all data
        tenants_data = await get_tenants_with_budgets(current_user, db)
        stats_data = await get_budget_stats(time_range, current_user, db)
        activity_data = await get_budget_activity(time_range, current_user, db)
        
        # Convert to JSON-serializable format
        export_data = {
            "export_metadata": {
                "generated_at": datetime.now().isoformat(),
                "time_range": time_range,
                "version": "1.0"
            },
            "summary": {
                "total_platform_budget": float(stats_data.total_platform_budget),
                "unallocated_budget": float(stats_data.unallocated_budget),
                "allocated_budget": float(stats_data.allocated_budget),
                "delegated_budget": float(stats_data.delegated_budget),
                "spendable_budget": float(stats_data.spendable_budget),
                "percentages": {
                    "unallocated": stats_data.unallocated_percent,
                    "allocated": stats_data.allocated_percent,
                    "delegated": stats_data.delegated_percent,
                    "spendable": stats_data.spendable_percent,
                },
                "deployment_rate": stats_data.deployment_rate,
                "active_tenants": stats_data.active_tenants,
            },
            "activity": {
                "allocations": {
                    "count": activity_data.allocations_count,
                    "total": float(activity_data.allocations_total)
                },
                "distributions": {
                    "count": activity_data.distributions_count,
                    "total": float(activity_data.distributions_total)
                },
                "awards": {
                    "count": activity_data.awards_count,
                    "total": float(activity_data.awards_total)
                },
                "clawbacks": {
                    "count": activity_data.clawbacks_count,
                    "total": float(activity_data.clawbacks_total)
                }
            },
            "tenants": [
                {
                    "tenant_id": str(t.tenant_id),
                    "tenant_name": t.tenant_name,
                    "status": t.status,
                    "subscription_tier": t.subscription_tier,
                    "budget_allocated": float(t.budget_allocated),
                    "total_lead_budgets": float(t.total_lead_budgets),
                    "total_wallet_balance": float(t.total_wallet_balance),
                    "total_active": float(t.total_active),
                    "utilization_percent": t.utilization_percent,
                }
                for t in tenants_data
            ]
        }
        
        return JSONResponse(
            content=export_data,
            headers={"Content-Disposition": f"attachment; filename=budget_ledger_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export JSON: {str(e)}"
        )
