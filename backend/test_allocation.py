from sqlalchemy.orm import Session
from database import SessionLocal
from models import User, Tenant
from core.budget_service import BudgetService
from decimal import Decimal
from uuid import UUID

# Test budget allocation
db = SessionLocal()
try:
    # Get platform admin
    admin = db.query(User).filter(User.corporate_email == 'super_user@sparknode.io').first()
    print(f"Admin: {admin.corporate_email}, Role: {admin.org_role}")

    # Get a tenant to allocate to
    tenant = db.query(Tenant).filter(Tenant.name == 'jSpark').first()
    print(f"Tenant: {tenant.name}, ID: {tenant.id}")
    print(f"Before allocation - allocated: {tenant.budget_allocated}, balance: {tenant.budget_allocation_balance}")

    # Allocate budget
    amount = Decimal('50000.00')
    print(f"Allocating {amount} to {tenant.name}...")

    updated_tenant, allocation_log, platform_log = BudgetService.allocateTenant(
        db=db,
        tenant=tenant,
        admin_user=admin,
        amount=amount,
        currency='INR',
        reference_note='Test allocation',
        invoice_number='TEST-001'
    )

    db.commit()
    print("Allocation successful!")
    print(f"After allocation - allocated: {updated_tenant.budget_allocated}, balance: {updated_tenant.budget_allocation_balance}")
    print(f"Allocation log: {allocation_log.amount} {allocation_log.currency}")

finally:
    db.close()
    print("Database session closed.")