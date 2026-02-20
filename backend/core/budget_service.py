"""
Budget Allocation Service

Reusable service for managing the multi-tier budget allocation system:
1. Platform Admin → Tenant (allocateTenant)
2. Tenant Manager → Lead/Employee (distributeTolead, awardToUser)

Implements proper ledger tracking, balance verification, and safety constraints.

**Terminology:**
- budget_allocated: Total budget allocated by platform admin to tenant
- budget_allocation_balance: Remaining budget available for distribution to leads
"""

from decimal import Decimal
from uuid import UUID
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from models import (
    Tenant, User, Wallet, WalletLedger, 
    BudgetAllocationLog, PlatformBudgetBillingLog, BudgetDistributionLog,
    AuditLog, Feed, Department, Budget, DepartmentBudget
)
from core.audit_service import AuditService, AuditActions
from core import append_impersonation_metadata


class BudgetAllocationError(Exception):
    """Custom exception for budget allocation failures"""
    pass


class BudgetService:
    """
    Service class for multi-tier budget allocation.
    
    Three core methods:
    - allocateTenant(): Platform Admin allocates budget to Tenant
    - distributeTolead(): Tenant Manager distributes budget from pool to Lead
    - awardToUser(): Recognition/Award from Lead/Manager to Employee's wallet
    """
    
    @staticmethod
    def allocateTenant(
        db: Session,
        tenant: Tenant,
        admin_user: User,
        amount: Decimal,
        currency: str = 'INR',
        reference_note: Optional[str] = None,
        invoice_number: Optional[str] = None
    ) -> Tuple[Tenant, BudgetAllocationLog, PlatformBudgetBillingLog]:
        """
        Platform Admin allocates budget to Tenant's distribution pool.
        
        Flow:
        1. Validate admin is platform admin
        2. Validate amount > 0
        3. Update tenant.budget_allocated (total allocated)
        4. Update tenant.budget_allocation_balance (available for distribution)
        5. Create BudgetAllocationLog (tenant-specific)
        6. Create PlatformBudgetBillingLog (platform audit)
        7. Log audit event
        
        Args:
            db: Database session
            tenant: Target tenant
            admin_user: Platform admin user
            amount: Budget to allocate
            currency: Currency code (default INR)
            reference_note: Reason/invoice description
            invoice_number: Invoice reference for reconciliation
            
        Returns:
            Tuple of (updated_tenant, budget_allocation_log, platform_billing_log)
            
        Raises:
            BudgetAllocationError: If validation fails
        """
        # Validate platform admin
        if not admin_user.is_platform_admin:
            raise BudgetAllocationError(f"User {admin_user.id} is not a platform admin")
        
        # Validate amount
        if amount <= 0:
            raise BudgetAllocationError("Allocation amount must be greater than 0")
        
        # Store previous balances for audit
        previous_allocated = tenant.budget_allocated
        previous_balance = tenant.budget_allocation_balance
        
        # Update tenant budget tracking
        tenant.budget_allocated = Decimal(str(tenant.budget_allocated)) + Decimal(str(amount))
        tenant.budget_allocation_balance = Decimal(str(tenant.budget_allocation_balance)) + Decimal(str(amount))
        
        # Create budget allocation log (tenant-specific)
        allocation_log = BudgetAllocationLog(
            tenant_id=tenant.id,
            admin_id=admin_user.id,
            amount=amount,
            currency=currency,
            reference_note=reference_note,
            transaction_type='CREDIT_INJECTION',
            previous_balance=previous_balance,
            new_balance=tenant.budget_allocation_balance
        )
        db.add(allocation_log)
        
        # Create platform billing log (for invoice reconciliation)
        platform_log = PlatformBudgetBillingLog(
            admin_id=admin_user.id,
            tenant_id=tenant.id,
            amount=amount,
            currency=currency,
            reference_note=reference_note,
            transaction_type='CREDIT_INJECTION',
            invoice_number=invoice_number
        )
        db.add(platform_log)
        
        # Create audit log
        audit = AuditLog(
            tenant_id=tenant.id,
            actor_id=admin_user.id,
            action=AuditActions.POINTS_ALLOCATED,
            entity_type="tenant",
            entity_id=tenant.id,
            old_values={
                "budget_allocated": str(previous_allocated),
                "budget_allocation_balance": str(previous_balance)
            },
            new_values=append_impersonation_metadata({
                "budget_allocated": str(tenant.budget_allocated),
                "budget_allocation_balance": str(tenant.budget_allocation_balance),
                "amount_added": str(amount),
                "reference_note": reference_note
            })
        )
        db.add(audit)
        
        # Note: Feed entry removed due to event_type constraint violation
        # Feed creation would require adding 'allocation' to allowed event types
        
        db.flush()
        return tenant, allocation_log, platform_log
    
    @staticmethod
    def distributeToLead(
        db: Session,
        tenant: Tenant,
        from_manager: User,
        to_lead: User,
        amount: Decimal,
        description: Optional[str] = None
    ) -> Tuple[Tenant, Wallet, BudgetDistributionLog]:
        """
        Tenant Manager distributes budget from tenant pool to a Lead.
        Deducts from tenant.budget_allocation_balance and adds to lead's wallet.
        
        Args:
            db: Database session
            tenant: Tenant entity
            from_manager: Manager distributing budget
            to_lead: Lead receiving budget
            amount: Budget to distribute
            description: Reason for distribution
            
        Returns:
            Tuple of (updated_tenant, updated_wallet, distribution_log)
            
        Raises:
            BudgetAllocationError: If insufficient balance or invalid user roles
        """
        # Validate manager role
        if from_manager.org_role not in ['tenant_manager', 'dept_lead']:
            raise BudgetAllocationError(
                f"User {from_manager.id} (role: {from_manager.org_role}) cannot distribute budget"
            )
        
        # Validate amount
        if amount <= 0:
            raise BudgetAllocationError("Distribution amount must be greater than 0")
        
        # Check tenant has sufficient balance
        if Decimal(str(tenant.budget_allocation_balance)) < Decimal(str(amount)):
            raise BudgetAllocationError(
                f"Insufficient balance. Available: {tenant.budget_allocation_balance}, "
                f"Requested: {amount}"
            )
        
        # Get or create lead's wallet
        lead_wallet = db.query(Wallet).filter(
            Wallet.user_id == to_lead.id,
            Wallet.tenant_id == tenant.id
        ).first()
        
        if not lead_wallet:
            lead_wallet = Wallet(
                tenant_id=tenant.id,
                user_id=to_lead.id,
                balance=0,
                lifetime_earned=0,
                lifetime_spent=0
            )
            db.add(lead_wallet)
            db.flush()
        
        # Store previous balances
        previous_tenant_balance = tenant.budget_allocation_balance
        previous_wallet_balance = lead_wallet.balance
        
        # Deduct from department budget if user belongs to one
        if from_manager.department_id:
            dept = db.query(Department).filter(Department.id == from_manager.department_id).first()
            if dept:
                if Decimal(str(dept.budget_balance)) < Decimal(str(amount)):
                    raise BudgetAllocationError(
                        f"Insufficient department budget. Available: {dept.budget_balance}, "
                        f"Requested: {amount}"
                    )
                dept.budget_balance = Decimal(str(dept.budget_balance)) - Decimal(str(amount))
                
                # Also update the per-master-budget tracker if there's an active budget
                active_budget = db.query(Budget).filter(
                    Budget.tenant_id == tenant.id,
                    Budget.status == 'active'
                ).first()
                if active_budget:
                    dept_budget = db.query(DepartmentBudget).filter(
                        DepartmentBudget.budget_id == active_budget.id,
                        DepartmentBudget.department_id == dept.id
                    ).first()
                    if dept_budget:
                        dept_budget.spent_points = Decimal(str(dept_budget.spent_points)) + Decimal(str(amount))
        
        # Deduct from tenant pool
        tenant.budget_allocation_balance = Decimal(str(tenant.budget_allocation_balance)) - Decimal(str(amount))
        
        # Add to lead's wallet
        lead_wallet.balance = Decimal(str(lead_wallet.balance)) + Decimal(str(amount))
        lead_wallet.lifetime_earned = Decimal(str(lead_wallet.lifetime_earned)) + Decimal(str(amount))
        
        # Create wallet ledger entry
        ledger = WalletLedger(
            tenant_id=tenant.id,
            wallet_id=lead_wallet.id,
            transaction_type='credit',
            source='manager_distribution',
            points=amount,
            balance_after=lead_wallet.balance,
            description=description or f"Budget distribution from {from_manager.full_name}",
            created_by=from_manager.id
        )
        db.add(ledger)
        
        # Create distribution log
        distribution_log = BudgetDistributionLog(
            tenant_id=tenant.id,
            from_user_id=from_manager.id,
            to_user_id=to_lead.id,
            amount=amount,
            transaction_type='MANUAL_AWARD',
            description=description or "Manager budget distribution to lead",
            previous_pool_balance=previous_tenant_balance,
            new_pool_balance=tenant.budget_allocation_balance
        )
        db.add(distribution_log)
        
        # Create audit log
        audit = AuditLog(
            tenant_id=tenant.id,
            actor_id=from_manager.id,
            action=AuditActions.POINTS_ALLOCATED,
            entity_type="wallet",
            entity_id=lead_wallet.id,
            old_values={
                "wallet_balance": str(previous_wallet_balance),
                "tenant_pool": str(previous_tenant_balance)
            },
            new_values=append_impersonation_metadata({
                "wallet_balance": str(lead_wallet.balance),
                "tenant_pool": str(tenant.budget_allocation_balance),
                "amount_distributed": str(amount)
            })
        )
        db.add(audit)
        
        # Create feed entry
        feed = Feed(
            tenant_id=tenant.id,
            event_type="distribution",
            reference_type="wallet",
            reference_id=lead_wallet.id,
            actor_id=from_manager.id,
            target_id=to_lead.id,
            visibility="internal",
            event_metadata={
                "action": "budget_distribution",
                "amount": str(amount),
                "from_user": from_manager.full_name,
                "to_user": to_lead.full_name,
                "role": "lead"
            }
        )
        db.add(feed)
        
        db.flush()
        return tenant, lead_wallet, distribution_log
    
    @staticmethod
    def awardToUser(
        db: Session,
        tenant: Tenant,
        from_user: User,
        to_user: User,
        amount: Decimal,
        reference_type: Optional[str] = None,
        reference_id: Optional[UUID] = None,
        description: Optional[str] = None
    ) -> Tuple[Wallet, WalletLedger, BudgetDistributionLog]:
        """
        Award budget from tenant pool to an employee's wallet.
        Can be called during recognition, event bonuses, or manual awards.
        
        This is the final step: budget leaves the pool and enters the user's personal wallet.
        
        Args:
            db: Database session
            tenant: Tenant entity
            from_user: User awarding budget (manager/lead/system)
            to_user: Employee receiving budget
            amount: Budget to award
            reference_type: Type of reference (recognition, event, etc.)
            reference_id: ID of reference (e.g., recognition ID)
            description: Award reason
            
        Returns:
            Tuple of (updated_wallet, wallet_ledger, distribution_log)
            
        Raises:
            BudgetAllocationError: If insufficient balance
        """
        # Validate amount
        if amount <= 0:
            raise BudgetAllocationError("Award amount must be greater than 0")
        
        # Check tenant has sufficient allocation balance
        if Decimal(str(tenant.budget_allocation_balance)) < Decimal(str(amount)):
            raise BudgetAllocationError(
                f"Insufficient tenant pool. Available: {tenant.budget_allocation_balance}, "
                f"Requested: {amount}"
            )
        
        # Get or create user's wallet
        wallet = db.query(Wallet).filter(
            Wallet.user_id == to_user.id,
            Wallet.tenant_id == tenant.id
        ).first()
        
        if not wallet:
            wallet = Wallet(
                tenant_id=tenant.id,
                user_id=to_user.id,
                balance=0,
                lifetime_earned=0,
                lifetime_spent=0
            )
            db.add(wallet)
            db.flush()
        
        # Store previous balances
        previous_pool_balance = tenant.budget_allocation_balance
        previous_wallet_balance = wallet.balance
        
        # Deduct from department budget if user belongs to one
        if from_user.department_id:
            dept = db.query(Department).filter(Department.id == from_user.department_id).first()
            if dept:
                if Decimal(str(dept.budget_balance)) < Decimal(str(amount)):
                    # Optional: Fall back to tenant pool or raise error
                    # For now, let's strictly enforce department budget if they have one
                    raise BudgetAllocationError(
                        f"Insufficient department budget. Available: {dept.budget_balance}, "
                        f"Requested: {amount}"
                    )
                dept.budget_balance = Decimal(str(dept.budget_balance)) - Decimal(str(amount))
                
                # Also update the per-master-budget tracker if there's an active budget
                active_budget = db.query(Budget).filter(
                    Budget.tenant_id == tenant.id,
                    Budget.status == 'active'
                ).first()
                if active_budget:
                    dept_budget = db.query(DepartmentBudget).filter(
                        DepartmentBudget.budget_id == active_budget.id,
                        DepartmentBudget.department_id == dept.id
                    ).first()
                    if dept_budget:
                        dept_budget.spent_points = Decimal(str(dept_budget.spent_points)) + Decimal(str(amount))
        
        # Deduct from tenant pool
        tenant.budget_allocation_balance = Decimal(str(tenant.budget_allocation_balance)) - Decimal(str(amount))
        
        # Add to user's wallet
        wallet.balance = Decimal(str(wallet.balance)) + Decimal(str(amount))
        wallet.lifetime_earned = Decimal(str(wallet.lifetime_earned)) + Decimal(str(amount))
        
        # Create wallet ledger entry
        ledger = WalletLedger(
            tenant_id=tenant.id,
            wallet_id=wallet.id,
            transaction_type='credit',
            source=reference_type or 'recognition',
            points=amount,
            balance_after=wallet.balance,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description or f"Award from {from_user.full_name}",
            created_by=from_user.id
        )
        db.add(ledger)
        
        # Create distribution log
        distribution_log = BudgetDistributionLog(
            tenant_id=tenant.id,
            from_user_id=from_user.id,
            to_user_id=to_user.id,
            amount=amount,
            transaction_type='RECOGNITION',
            reference_type=reference_type,
            reference_id=reference_id,
            description=description,
            previous_pool_balance=previous_pool_balance,
            new_pool_balance=tenant.budget_allocation_balance
        )
        db.add(distribution_log)
        
        # Create audit log
        audit = AuditLog(
            tenant_id=tenant.id,
            actor_id=from_user.id,
            action=AuditActions.POINTS_ALLOCATED,
            entity_type="wallet",
            entity_id=wallet.id,
            old_values={
                "wallet_balance": str(previous_wallet_balance),
                "tenant_pool": str(previous_pool_balance)
            },
            new_values=append_impersonation_metadata({
                "wallet_balance": str(wallet.balance),
                "tenant_pool": str(tenant.budget_allocation_balance),
                "amount_awarded": str(amount),
                "reference_type": reference_type
            })
        )
        db.add(audit)
        
        # Create feed entry for recognition
        feed = Feed(
            tenant_id=tenant.id,
            event_type=reference_type or "recognition",
            reference_type=reference_type,
            reference_id=reference_id,
            actor_id=from_user.id,
            target_id=to_user.id,
            visibility="public",
            event_metadata={
                "action": "award",
                "amount": str(amount),
                "from_user": from_user.full_name,
                "to_user": to_user.full_name,
                "description": description
            }
        )
        db.add(feed)
        
        db.flush()
        return wallet, ledger, distribution_log
    
    @staticmethod
    def clawbackBudget(
        db: Session,
        tenant: Tenant,
        admin_user: User,
        amount: Optional[Decimal] = None,
        reason: str = "Budget clawback"
    ) -> BudgetAllocationLog:
        """
        Platform Admin claws back budget from a tenant (e.g., subscription cancellation).
        Optionally zeroes out the entire balance.
        
        Args:
            db: Database session
            tenant: Target tenant
            admin_user: Platform admin
            amount: Amount to clawback (if None, claws back entire balance)
            reason: Reason for clawback
            
        Returns:
            BudgetAllocationLog entry
        """
        if not admin_user.is_platform_admin:
            raise BudgetAllocationError(f"User {admin_user.id} is not a platform admin")
        
        # Use full balance if amount not specified
        clawback_amount = amount or tenant.budget_allocation_balance
        
        if clawback_amount <= 0:
            raise BudgetAllocationError("Clawback amount must be greater than 0")
        
        if clawback_amount > tenant.budget_allocation_balance:
            raise BudgetAllocationError(
                f"Cannot clawback more than available. Available: {tenant.budget_allocation_balance}, "
                f"Requested: {clawback_amount}"
            )
        
        previous_balance = tenant.budget_allocation_balance
        previous_allocated = tenant.budget_allocated
        
        tenant.budget_allocation_balance = Decimal(str(tenant.budget_allocation_balance)) - Decimal(str(clawback_amount))
        tenant.budget_allocated = Decimal(str(tenant.budget_allocated)) - Decimal(str(clawback_amount))
        
        allocation_log = BudgetAllocationLog(
            tenant_id=tenant.id,
            admin_id=admin_user.id,
            amount=clawback_amount,
            transaction_type='CLAWBACK',
            reference_note=reason,
            previous_balance=previous_balance,
            new_balance=tenant.budget_allocation_balance
        )
        db.add(allocation_log)
        
        # Audit
        audit = AuditLog(
            tenant_id=tenant.id,
            actor_id=admin_user.id,
            action="budget_clawback",
            entity_type="tenant",
            entity_id=tenant.id,
            old_values={
                "budget_allocated": str(previous_allocated),
                "budget_allocation_balance": str(previous_balance)
            },
            new_values=append_impersonation_metadata({
                "budget_allocated": str(tenant.budget_allocated),
                "budget_allocation_balance": str(tenant.budget_allocation_balance),
                "amount_clawed_back": str(clawback_amount),
                "reason": reason
            })
        )
        db.add(audit)
        
        db.flush()
        return allocation_log
    
    @staticmethod
    def get_tenant_budget_stats(db: Session, tenant: Tenant) -> dict:
        """
        Get summary statistics for a tenant's budget allocation pool.
        
        Returns:
            Dict with balance, allocated_total, distributed_today, etc.
        """
        from datetime import datetime
        
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Budget distributed today
        distributed_today = db.query(func.sum(BudgetDistributionLog.amount)).filter(
            BudgetDistributionLog.tenant_id == tenant.id,
            BudgetDistributionLog.created_at >= today_start
        ).scalar() or 0
        
        # Total distributed (lifetime)
        total_distributed = db.query(func.sum(BudgetDistributionLog.amount)).filter(
            BudgetDistributionLog.tenant_id == tenant.id
        ).scalar() or 0
        
        return {
            "budget_allocated_total": float(tenant.budget_allocated),
            "budget_allocation_balance": float(tenant.budget_allocation_balance),
            "distributed_today": float(distributed_today),
            "total_distributed": float(total_distributed),
            "available_for_distribution": float(tenant.budget_allocation_balance),
            "currency": "INR"
        }
