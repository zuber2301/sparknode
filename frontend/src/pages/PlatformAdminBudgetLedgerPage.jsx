import React from 'react'
import { useAuthStore } from '../store/authStore'
import { Navigate } from 'react-router-dom'
import PlatformAdminBudgetLedger from '../components/PlatformAdminBudgetLedger'
import BudgetAlerts from '../components/BudgetAlerts'
import { HiOutlineArrowLeft } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'

/**
 * Platform Admin Budget Ledger Page
 * 
 * Displays the complete platform budget ledger showing:
 * - Budget allocation across all tiers
 * - Tenant breakdown with utilization metrics
 * - Activity history
 * - Export functionality
 * 
 * Requires: platform_admin role
 */
export default function PlatformAdminBudgetLedgerPage() {
  const { user, getEffectiveRole } = useAuthStore()
  const navigate = useNavigate()
  const effectiveRole = getEffectiveRole()
  const isPlatformAdmin = effectiveRole === 'platform_admin'

  // Redirect if not platform admin
  if (!isPlatformAdmin) {
    return <Navigate to="/dashboard" />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin-dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to Admin Dashboard"
            >
              <HiOutlineArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Budget Ledger</h1>
              <p className="text-gray-600 mt-1">
                Platform-wide budget allocation and tenant utilization metrics
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts Section */}
        <div className="mb-8">
          <BudgetAlerts />
        </div>

        {/* Main Ledger Component */}
        <PlatformAdminBudgetLedger />
      </div>
    </div>
  )
}
