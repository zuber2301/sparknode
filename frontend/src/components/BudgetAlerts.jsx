import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HiOutlineExclamationCircle, HiOutlineCheckCircle, HiOutlineBell, HiOutlineX } from 'react-icons/hi'
import { platformAPI } from '../lib/api'

/**
 * Budget Alert Display Component
 * 
 * Shows current budget alerts for all tenants:
 * - Warning: >= 50% budget depleted
 * - Critical: >= 75% budget depleted
 * - Emergency: >= 90% budget depleted
 */
export default function BudgetAlerts() {
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set())

  // Fetch current budget health
  const { data: alerts, isLoading, error } = useQuery({
    queryKey: ['platform', 'alerts', 'health'],
    queryFn: () => platformAPI.checkBudgetHealth(),
    refetchInterval: 300000, // Refresh every 5 minutes
  })

  if (isLoading) {
    return null // Don't show loading state, just empty
  }

  if (error) {
    console.error('Failed to fetch alerts:', error)
    return null // Don't show error state for background alerts
  }

  const activeAlerts = (alerts || []).filter(
    alert => !dismissedAlerts.has(alert.tenant_id)
  )

  if (activeAlerts.length === 0) {
    return null
  }

  const handleDismiss = (tenantId) => {
    setDismissedAlerts(prev => new Set([...prev, tenantId]))
  }

  const getAlertColor = (level) => {
    switch (level) {
      case 'emergency':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'critical':
        return 'bg-orange-50 border-orange-200 text-orange-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800'
    }
  }

  const getAlertIcon = (level) => {
    switch (level) {
      case 'emergency':
        return <div className="text-2xl">🚨</div>
      case 'critical':
        return <div className="text-2xl">⚠️</div>
      case 'warning':
        return <div className="text-2xl">⚠️</div>
      default:
        return <HiOutlineBell className="w-6 h-6" />
    }
  }

  return (
    <div className="space-y-2">
      {activeAlerts.map(alert => (
        <div
          key={alert.tenant_id}
          className={`border rounded-lg p-4 ${getAlertColor(alert.alert_level)} flex items-start justify-between gap-4`}
        >
          <div className="flex items-start gap-3 flex-1">
            <div className="flex-shrink-0 mt-1">
              {getAlertIcon(alert.alert_level)}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{alert.tenant_name}</h3>
              <p className="text-sm mb-2">{alert.message}</p>
              <div className="text-xs opacity-75">
                Remaining: ₹{parseFloat(alert.unallocated_budget).toLocaleString('en-IN', { 
                  minimumFractionDigits: 0, 
                  maximumFractionDigits: 0 
                })} ({alert.unallocated_percent.toFixed(1)}%)
              </div>
            </div>
          </div>
          <button
            onClick={() => handleDismiss(alert.tenant_id)}
            className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
            title="Dismiss alert"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  )
}
