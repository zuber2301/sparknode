"""
Points Allocation Service

**DEPRECATED: Use BudgetService in budget_service.py instead**

This file is maintained for backward compatibility only.
All references to "points allocation" have been renamed to "budget allocation".

For new code, import from budget_service.py:
    from core.budget_service import BudgetService
"""

# Import the new budget service
from core.budget_service import BudgetService, BudgetAllocationError

# Backward compatibility: alias old class names to new budget service
PointsService = BudgetService
PointsAllocationError = BudgetAllocationError

__all__ = ['PointsService', 'PointsAllocationError', 'BudgetService', 'BudgetAllocationError']
