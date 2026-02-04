/**
 * Points Ledger Integration
 * Hooks and utilities for integrating Points Ledger components with the app
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import toast from 'react-hot-toast'

/**
 * Hook: Fetch allocation history for a specific tenant
 * Used by: Platform Admin Ledger
 */
export function useAllocationHistory(tenantId, filters = {}) {
  const { filterType = 'all', dateRange = '30days', sortBy = 'recent' } = filters

  return useQuery({
    queryKey: ['allocations', 'history', tenantId, filterType, dateRange, sortBy],
    queryFn: async () => {
      if (!tenantId) return { allocations: [], billing: [] }
      
      const params = new URLSearchParams({
        tenant_id: tenantId,
        type: filterType,
        range: dateRange,
        sort: sortBy
      })

      const res = await fetch(`/api/platform/allocations/history/${tenantId}?${params}`)
      if (!res.ok) throw new Error('Failed to fetch allocation history')
      
      return res.json()
    },
    enabled: !!tenantId,
    staleTime: 60000 // 1 minute
  })
}

/**
 * Hook: Fetch allocation statistics for a tenant
 * Used by: Dashboard cards, admin panels
 */
export function useAllocationStats(tenantId) {
  return useQuery({
    queryKey: ['allocations', 'stats', tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/platform/allocations/stats/${tenantId}`)
      if (!res.ok) throw new Error('Failed to fetch allocation stats')
      return res.json()
    },
    enabled: !!tenantId,
    staleTime: 120000 // 2 minutes
  })
}

/**
 * Hook: Fetch distribution history within a tenant
 * Used by: Tenant Manager Ledger
 */
export function useDistributionHistory(filters = {}) {
  const { filterType = 'all', dateRange = '30days', sortBy = 'recent' } = filters

  return useQuery({
    queryKey: ['distributions', 'tenant', filterType, dateRange, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: filterType,
        range: dateRange,
        sort: sortBy
      })

      const res = await fetch(`/api/allocations/history/tenant?${params}`)
      if (!res.ok) throw new Error('Failed to fetch distribution history')
      return res.json()
    },
    staleTime: 60000
  })
}

/**
 * Hook: Fetch distribution history for current user
 * Used by: My Distributions tab
 */
export function useMyDistributionHistory(filters = {}) {
  const { filterType = 'all', dateRange = '30days' } = filters

  return useQuery({
    queryKey: ['distributions', 'my', filterType, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: filterType,
        range: dateRange
      })

      const res = await fetch(`/api/allocations/history?${params}`)
      if (!res.ok) throw new Error('Failed to fetch distribution history')
      return res.json()
    },
    staleTime: 60000
  })
}

/**
 * Hook: Fetch allocation pool status
 * Used by: Manager dashboard, distribution forms
 */
export function useAllocationPool() {
  return useQuery({
    queryKey: ['allocations', 'pool'],
    queryFn: async () => {
      const res = await fetch('/api/allocations/pool')
      if (!res.ok) throw new Error('Failed to fetch pool status')
      return res.json()
    },
    staleTime: 30000 // 30 seconds - more frequent updates
  })
}

/**
 * Hook: Fetch employee wallet ledger
 * Used by: Employee Wallet Ledger
 */
export function useWalletLedger(dateRange = 'all') {
  return useQuery({
    queryKey: ['wallet', 'ledger', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ range: dateRange })
      const res = await fetch(`/api/wallets/me/ledger?${params}`)
      if (!res.ok) throw new Error('Failed to fetch wallet ledger')
      return res.json()
    },
    staleTime: 60000
  })
}

/**
 * Hook: Fetch current wallet balance
 * Used by: Wallet header, balance cards
 */
export function useWalletBalance() {
  return useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: async () => {
      const res = await fetch('/api/wallets/me')
      if (!res.ok) throw new Error('Failed to fetch wallet balance')
      return res.json()
    },
    staleTime: 30000
  })
}

/**
 * Hook: Allocate points to a tenant (Platform Admin only)
 * Used by: Allocation form
 */
export function useAllocatePoints() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/platform/allocations/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'Failed to allocate points')
      }
      
      return res.json()
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['allocations', 'stats', variables.tenant_id] })
      toast.success(`Allocated ${variables.amount.toLocaleString()} points successfully`)
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })
}

/**
 * Hook: Clawback points from a tenant (Platform Admin only)
 * Used by: Clawback form
 */
export function useClawbackPoints() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/platform/allocations/clawback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'Failed to clawback points')
      }
      
      return res.json()
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['allocations', 'stats', variables.tenant_id] })
      toast.success('Points clawed back successfully')
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })
}

/**
 * Hook: Award points to an employee (Tenant Manager only)
 * Used by: Award form
 */
export function useAwardPoints() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/allocations/award-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'Failed to award points')
      }
      
      return res.json()
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['distributions'] })
      queryClient.invalidateQueries({ queryKey: ['allocations', 'pool'] })
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      toast.success(`Awarded ${variables.amount.toLocaleString()} points`)
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })
}

/**
 * Hook: Distribute points to a lead (Tenant Manager only)
 * Used by: Delegation form
 */
export function useDistributeToLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/allocations/distribute-to-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'Failed to distribute points')
      }
      
      return res.json()
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['distributions'] })
      queryClient.invalidateQueries({ queryKey: ['allocations', 'pool'] })
      toast.success(`Delegated ${variables.amount.toLocaleString()} points`)
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })
}

/**
 * Utility: Format large numbers with commas
 */
export function formatNumber(num) {
  return typeof num === 'number' ? num.toLocaleString() : '0'
}

/**
 * Utility: Get color class for transaction type
 */
export function getTransactionColor(type) {
  const colors = {
    CREDIT_INJECTION: 'text-green-600 bg-green-50',
    CLAWBACK: 'text-red-600 bg-red-50',
    RECOGNITION: 'text-blue-600 bg-blue-50',
    MANUAL_AWARD: 'text-purple-600 bg-purple-50',
    REDEMPTION: 'text-orange-600 bg-orange-50',
    EXPIRY: 'text-gray-600 bg-gray-50'
  }
  return colors[type] || 'text-gray-600 bg-gray-50'
}

/**
 * Utility: Get badge label for transaction type
 */
export function getTransactionLabel(type) {
  const labels = {
    CREDIT_INJECTION: 'Allocation',
    CLAWBACK: 'Clawback',
    RECOGNITION: 'Recognition',
    MANUAL_AWARD: 'Delegation',
    REDEMPTION: 'Redemption',
    EXPIRY: 'Expired'
  }
  return labels[type] || type
}

export default {
  useAllocationHistory,
  useAllocationStats,
  useDistributionHistory,
  useMyDistributionHistory,
  useAllocationPool,
  useWalletLedger,
  useWalletBalance,
  useAllocatePoints,
  useClawbackPoints,
  useAwardPoints,
  useDistributeToLead,
  formatNumber,
  getTransactionColor,
  getTransactionLabel
}
