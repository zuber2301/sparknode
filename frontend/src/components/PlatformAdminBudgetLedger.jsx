import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HiOutlineCurrencyRupee, HiOutlineArrowRight, HiOutlineChartBar, HiOutlineDownload } from 'react-icons/hi'
import { platformAPI, tenantsAPI } from '../lib/api'

/**
 * Platform Admin Budget Ledger
 * 
 * Master view of budget distribution across the entire platform:
 * - Unallocated: Budget sitting in platform reserve
 * - Allocated: Budget in tenant pools (ready to distribute)
 * - Delegated: Budget with team leads
 * - Spendable: Budget in employee wallets
 */
export default function PlatformAdminBudgetLedger() {
  const [timeRange, setTimeRange] = useState('all') // all, 30days, 90days
  const [sortBy, setSortBy] = useState('allocated') // allocated, spent, active  const [isExporting, setIsExporting] = useState(false)
  // Fetch all tenants with their budget data
  const { data: tenantsData, isLoading: tenantsLoading } = useQuery({
    queryKey: ['platform', 'ledger', 'tenants'],
    queryFn: () => platformAPI.getTenantsWithBudgets(),
  })

  // Fetch platform-wide budget stats
  const { data: budgetStatsData, isLoading: statsLoading } = useQuery({
    queryKey: ['platform', 'ledger', 'stats', timeRange],
    queryFn: () => platformAPI.getBudgetStats({ time_range: timeRange }),
  })

  // Calculate budget tiers
  const budgetTiers = useMemo(() => {
    if (!tenantsData) return null

    const tenants = Array.isArray(tenantsData) ? tenantsData : []
    
    const stats = budgetStatsData || {}
    const platformTotal = Number(stats.total_platform_budget) || 0
    
    let allocatedTotal = 0
    let delegatedTotal = 0
    let spendableTotal = 0

    const tenantBreakdown = tenants.map(tenant => {
      const tenantAllocated = Number(tenant.budget_allocated) || 0
      const tenantDelegated = Number(tenant.total_lead_budgets) || 0
      const tenantSpendable = Number(tenant.total_wallet_balance) || 0
      
      allocatedTotal += tenantAllocated
      delegatedTotal += tenantDelegated
      spendableTotal += tenantSpendable

      return {
        tenantId: tenant.tenant_id,
        tenantName: tenant.tenant_name,
        allocated: tenantAllocated,
        delegated: tenantDelegated,
        spendable: tenantSpendable,
        total: tenantAllocated + tenantDelegated + tenantSpendable
      }
    })

    // Sort tenants
    const sorted = [...tenantBreakdown].sort((a, b) => {
      if (sortBy === 'allocated') return b.allocated - a.allocated
      if (sortBy === 'spent') return b.spendable - a.spendable
      return b.total - a.total
    })

    const unallocated = Math.max(0, platformTotal - (allocatedTotal + delegatedTotal + spendableTotal))

    return {
      unallocated,
      allocated: allocatedTotal,
      delegated: delegatedTotal,
      spendable: spendableTotal,
      platformTotal,
      tenants: sorted
    }
  }, [tenantsData, budgetStatsData, sortBy])

  if (tenantsLoading || statsLoading) {
    return (
      <div className="bg-white rounded-lg p-8 text-center">
        <div className="inline-block animate-spin">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
        </div>
        <p className="mt-4 text-gray-600">Loading budget ledger...</p>
      </div>
    )
  }

  if (!budgetTiers) {
    return (
      <div className="bg-white rounded-lg p-8 text-center">
        <p className="text-gray-600">No budget data available</p>
      </div>
    )
  }

  const handleExport = async (format) => {
    try {
      setIsExporting(true)
      let response
      
      if (format === 'csv') {
        response = await platformAPI.exportBudgetLedgerCSV({ time_range: timeRange })
      } else if (format === 'json') {
        response = await platformAPI.exportBudgetLedgerJSON({ time_range: timeRange })
      }
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `budget_ledger_${new Date().toISOString().split('T')[0]}.${format}`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error(`Failed to export ${format}:`, error)
      alert(`Failed to export ${format.toUpperCase()}: ${error.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const totalBudget = budgetTiers.platformTotal
  const unallocPct = (budgetTiers.unallocated / totalBudget) * 100
  const allocPct = (budgetTiers.allocated / totalBudget) * 100
  const delegPct = (budgetTiers.delegated / totalBudget) * 100
  const spendPct = (budgetTiers.spendable / totalBudget) * 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budget Ledger</h1>
          <p className="text-gray-600 mt-2">Master view of budget allocation across all tenants</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button 
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <HiOutlineDownload className="w-5 h-5" />
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
            {/* Dropdown menu */}
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleExport('csv')}
                disabled={isExporting}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 disabled:opacity-50 first:rounded-t-lg text-sm font-medium text-gray-700"
              >
                📊 Export as CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                disabled={isExporting}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 disabled:opacity-50 last:rounded-b-lg text-sm font-medium text-gray-700"
              >
                📋 Export as JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Waterfall */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-6">Budget Waterfall</h2>
        
        <div className="space-y-4">
          {/* Unallocated */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">Unallocated (Platform Reserve)</span>
                <span className="text-lg font-bold text-gray-900">₹{budgetTiers.unallocated?.toLocaleString('en-IN')}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gray-400 h-full rounded-full"
                  style={{ width: `${Math.max(unallocPct, 2)}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-1">{unallocPct.toFixed(1)}% of total</p>
            </div>
            <HiOutlineArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </div>

          {/* Allocated */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">Allocated (Tenant Pools)</span>
                <span className="text-lg font-bold text-blue-600">₹{budgetTiers.allocated?.toLocaleString('en-IN')}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-blue-500 h-full rounded-full"
                  style={{ width: `${Math.max(allocPct, 2)}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-1">{allocPct.toFixed(1)}% of total • Ready for manager distribution</p>
            </div>
            <HiOutlineArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </div>

          {/* Delegated */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">Delegated (With Leads)</span>
                <span className="text-lg font-bold text-purple-600">₹{budgetTiers.delegated?.toLocaleString('en-IN')}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-purple-500 h-full rounded-full"
                  style={{ width: `${Math.max(delegPct, 2)}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-1">{delegPct.toFixed(1)}% of total • Distributed to department leads</p>
            </div>
            <HiOutlineArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </div>

          {/* Spendable */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">Spendable (User Wallets)</span>
                <span className="text-lg font-bold text-green-600">₹{budgetTiers.spendable?.toLocaleString('en-IN')}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-green-500 h-full rounded-full"
                  style={{ width: `${Math.max(spendPct, 2)}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-1">{spendPct.toFixed(1)}% of total • In employee wallets</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Platform Budget</p>
          <p className="text-2xl font-bold text-gray-900">₹{budgetTiers.platformTotal?.toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-2">Across {budgetTiers.tenants?.length || 0} tenants</p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-gray-400">
          <p className="text-sm text-gray-500 mb-1">Unallocated Reserve</p>
          <p className="text-2xl font-bold text-gray-900">₹{budgetTiers.unallocated?.toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-2">Available to allocate</p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-400">
          <p className="text-sm text-gray-500 mb-1">Tenant Pools</p>
          <p className="text-2xl font-bold text-blue-600">₹{budgetTiers.allocated?.toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-2">Waiting for distribution</p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-400">
          <p className="text-sm text-gray-500 mb-1">In Use</p>
          <p className="text-2xl font-bold text-green-600">₹{(budgetTiers.delegated + budgetTiers.spendable)?.toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-2">{((budgetTiers.delegated + budgetTiers.spendable) / budgetTiers.platformTotal * 100).toFixed(1)}% deployed</p>
        </div>
      </div>

      {/* Tenant Breakdown */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Tenant Breakdown</h2>
            <div className="flex items-center gap-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg"
              >
                <option value="all">All Time</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg"
              >
                <option value="allocated">Sort by Allocated</option>
                <option value="spent">Sort by Spendable</option>
                <option value="active">Sort by Active</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tenant Name</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Allocated</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Delegated</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Spendable</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Total Active</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {budgetTiers.tenants?.map(tenant => {
                const activeTotal = tenant.delegated + tenant.spendable
                const utilizationPct = tenant.allocated > 0 
                  ? Math.round((activeTotal / (tenant.allocated + activeTotal)) * 100)
                  : 0
                
                return (
                  <tr key={tenant.tenantId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {tenant.tenantName}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      <span className="font-semibold text-blue-600">₹{tenant.allocated?.toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      <span className="font-semibold text-purple-600">₹{tenant.delegated?.toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      <span className="font-semibold text-green-600">₹{tenant.spendable?.toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      <span className="font-semibold">₹{activeTotal?.toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-full rounded-full"
                            style={{ width: `${utilizationPct}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-700 min-w-10">{utilizationPct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Stats */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Total Allocated</p>
              <p className="text-lg font-bold text-blue-600">₹{budgetTiers.allocated?.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Delegated</p>
              <p className="text-lg font-bold text-purple-600">₹{budgetTiers.delegated?.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Spendable</p>
              <p className="text-lg font-bold text-green-600">₹{budgetTiers.spendable?.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Deployment Rate</p>
              <p className="text-lg font-bold text-gray-900">
                {((budgetTiers.allocated + budgetTiers.delegated + budgetTiers.spendable) / budgetTiers.platformTotal * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How This Works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ <strong>Unallocated:</strong> Budget held in platform reserve, ready to allocate to tenants</li>
          <li>✓ <strong>Allocated:</strong> Budget in tenant pools, waiting for managers to distribute to leads</li>
          <li>✓ <strong>Delegated:</strong> Budget distributed to department leads, ready to award to employees</li>
          <li>✓ <strong>Spendable:</strong> Budget in employee wallets, ready to redeem in marketplace</li>
        </ul>
      </div>
    </div>
  )
}
