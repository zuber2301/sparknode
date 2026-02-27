/**
 * Points Ledger Integration
 * Hooks and utilities for integrating Points Ledger components with the app.
 * All API calls use the centralized axios client to ensure auth tokens
 * and X-Tenant-ID headers are always sent.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
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

      const res = await api.get(`/platform/allocations/history/${tenantId}`, {
        params: { tenant_id: tenantId, type: filterType, range: dateRange, sort: sortBy },
        headers: { 'X-Skip-Tenant': '1' }
      })
      return res.data
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
      const res = await api.get(`/platform/allocations/stats/${tenantId}`, {
        headers: { 'X-Skip-Tenant': '1' }
      })
      return res.data
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
      const res = await api.get('/allocations/history/tenant', {
        params: { type: filterType, range: dateRange, sort: sortBy }
      })
      return res.data
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
      const res = await api.get('/allocations/history', {
        params: { type: filterType, range: dateRange }
      })
      return res.data
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
      const res = await api.get('/allocations/pool')
      return res.data
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
      const res = await api.get('/wallets/me/ledger', { params: { range: dateRange } })
      return res.data
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
      const res = await api.get('/wallets/me')
      return res.data
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
      const res = await api.post('/platform/allocations/allocate', data, {
        headers: { 'X-Skip-Tenant': '1' }
      })
      return res.data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['allocations', 'stats', variables.tenant_id] })
      toast.success(`Allocated ${variables.amount.toLocaleString('en-IN')} points successfully`)
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
      const res = await api.post('/platform/allocations/clawback', data, {
        headers: { 'X-Skip-Tenant': '1' }
      })
      return res.data
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
      const res = await api.post('/allocations/award-points', data)
      return res.data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['distributions'] })
      queryClient.invalidateQueries({ queryKey: ['allocations', 'pool'] })
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      toast.success(`Awarded ${variables.amount.toLocaleString('en-IN')} points`)
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
      const res = await api.post('/allocations/distribute-to-lead', data)
      return res.data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['distributions'] })
      queryClient.invalidateQueries({ queryKey: ['allocations', 'pool'] })
      toast.success(`Delegated ${variables.amount.toLocaleString('en-IN')} points`)
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
  return typeof num === 'number' ? num.toLocaleString('en-IN') : '0'
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
