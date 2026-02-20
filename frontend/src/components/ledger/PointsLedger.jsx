/**
 * Budget Ledger UI Components
 * 
 * Three main components:
 * 1. PlatformAdminLedger - Show budget allocation history for all tenants
 * 2. TenantManagerLedger - Show budget distribution history within tenant
 * 3. EmployeeWalletLedger - Show personal wallet transactions
 */

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { HiArrowUp, HiArrowDown, HiEye, HiDownload, HiFilter } from 'react-icons/hi'
import { toast } from 'react-hot-toast'

/**
 * ============================================================================
 * 1. PLATFORM ADMIN LEDGER
 * ============================================================================
 * Shows budget allocation history, clawbacks, and billing logs for all tenants
 */

export function PlatformAdminLedger() {
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [filterType, setFilterType] = useState('all') // all, credit, clawback
  const [dateRange, setDateRange] = useState('30days') // 7days, 30days, 90days, custom
  const [sortBy, setSortBy] = useState('recent') // recent, oldest, amount_high, amount_low

  // Fetch tenants for dropdown
  const { data: tenantsData } = useQuery({
    queryKey: ['tenants', 'active'],
    queryFn: () => fetch('/api/tenants?status=active').then(r => r.json())
  })

  // Fetch budget allocation history
  const { data: allocationsData, isLoading } = useQuery({
    queryKey: ['budgets', 'history', selectedTenant, filterType, dateRange],
    queryFn: async () => {
      if (!selectedTenant) return { allocations: [], billing: [] }
      const params = new URLSearchParams({
        tenant_id: selectedTenant,
        type: filterType,
        range: dateRange
      })
      const res = await fetch(`/api/platform/budgets/history?${params}`)
      return res.json()
    },
    enabled: !!selectedTenant
  })

  const handleExportCSV = () => {
    if (!allocationsData?.allocations) return
    
    const csv = [
      ['Date', 'Tenant', 'Admin', 'Amount', 'Type', 'Reference', 'Status'].join(','),
      ...allocationsData.allocations.map(a => [
        format(parseISO(a.created_at), 'yyyy-MM-dd HH:mm'),
        a.tenant_name,
        a.admin_name,
        a.amount,
        a.transaction_type,
        a.reference_note || '-',
        a.status || 'completed'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `budgets-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Budget Allocation Ledger</h1>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
        >
          <HiDownload className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Tenant Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tenant
            </label>
            <select
              value={selectedTenant || ''}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a tenant...</option>
              {tenantsData?.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.subscription_tier})
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Transactions</option>
              <option value="CREDIT_INJECTION">Allocations</option>
              <option value="CLAWBACK">Clawbacks</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="90days">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
              <option value="amount_high">Highest Amount</option>
              <option value="amount_low">Lowest Amount</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-lg p-12 text-center">
          <div className="inline-block animate-spin">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
          </div>
          <p className="mt-4 text-gray-600">Loading budget allocation history...</p>
        </div>
      ) : allocationsData?.allocations?.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tenant</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Admin</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Reference</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allocationsData.allocations.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {format(parseISO(entry.created_at), 'MMM dd, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {entry.tenant_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {entry.admin_name}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-right">
                    <span className={entry.transaction_type === 'CREDIT_INJECTION' ? 'text-green-600' : 'text-red-600'}>
                      {entry.transaction_type === 'CREDIT_INJECTION' ? '+' : '-'}
                      {entry.amount.toLocaleString('en-IN')} pts
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      entry.transaction_type === 'CREDIT_INJECTION'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {entry.transaction_type === 'CREDIT_INJECTION' ? 'Allocation' : 'Clawback'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {entry.reference_note ? entry.reference_note.substring(0, 30) + '...' : '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <AllocationDetailModal entry={entry} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-12 text-center">
          <HiFilter className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No allocations found. Select a tenant to view history.</p>
        </div>
      )}
    </div>
  )
}

/**
 * Modal for viewing full allocation details
 */
function AllocationDetailModal({ entry }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-blue-600 hover:text-blue-800 p-2"
      >
        <HiEye className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-96 overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">Allocation Details</h2>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-medium">{format(parseISO(entry.created_at), 'PPpp')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tenant</p>
                <p className="font-medium">{entry.tenant_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Admin</p>
                <p className="font-medium">{entry.admin_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Amount</p>
                <p className="font-medium text-lg">
                  {entry.transaction_type === 'CREDIT_INJECTION' ? '+' : '-'}
                  {entry.amount.toLocaleString('en-IN')} points
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Previous Balance</p>
                <p className="font-medium">{entry.previous_balance?.toLocaleString('en-IN') || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">New Balance</p>
                <p className="font-medium">{entry.new_balance?.toLocaleString('en-IN') || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Reference/Notes</p>
                <p className="font-medium">{entry.reference_note || 'No notes'}</p>
              </div>
              {entry.invoice_number && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Invoice Number</p>
                  <p className="font-mono font-medium">{entry.invoice_number}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="mt-6 w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * ============================================================================
 * 2. TENANT MANAGER LEDGER
 * ============================================================================
 * Shows distribution history within a single tenant
 */

export function TenantManagerLedger() {
  const [filterType, setFilterType] = useState('all') // all, delegation, award
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [dateRange, setDateRange] = useState('30days')
  const [sortBy, setSortBy] = useState('recent')

  // Fetch budget distribution history
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['budget-distributions', 'tenant', filterType, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ type: filterType, range: dateRange })
      const res = await fetch(`/api/budgets/history/tenant?${params}`)
      return res.json()
    }
  })

  // Get unique employees for filtering
  const employees = historyData?.reduce((acc, entry) => {
    if (!acc.find(e => e.id === entry.to_user_id)) {
      acc.push({ id: entry.to_user_id, name: entry.to_user_name })
    }
    return acc
  }, []) || []

  const handleExportCSV = () => {
    if (!historyData) return
    
    const csv = [
      ['Date', 'From', 'To', 'Amount', 'Type', 'Description'].join(','),
      ...historyData.map(entry => [
        format(parseISO(entry.created_at), 'yyyy-MM-dd HH:mm'),
        entry.from_user_name,
        entry.to_user_name,
        entry.amount,
        entry.transaction_type,
        entry.description || '-'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `distributions-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  const filteredData = selectedEmployee
    ? historyData?.filter(e => e.to_user_id === selectedEmployee)
    : historyData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Budget Distribution History</h1>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
        >
          <HiDownload className="w-5 h-5" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Employee Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee
            </label>
            <select
              value={selectedEmployee || ''}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Employees</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Types</option>
              <option value="MANUAL_AWARD">Delegations</option>
              <option value="RECOGNITION">Recognitions</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="90days">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
              <option value="amount_high">Highest Amount</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600">Total Distributed</p>
          <p className="text-2xl font-bold text-green-600">
            {filteredData?.reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-IN')} pts
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600">Transactions</p>
          <p className="text-2xl font-bold">{filteredData?.length || 0}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600">Average Award</p>
          <p className="text-2xl font-bold text-blue-600">
            {filteredData?.length > 0 
              ? Math.round(filteredData.reduce((sum, e) => sum + e.amount, 0) / filteredData.length).toLocaleString('en-IN')
              : 0
            } pts
          </p>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-lg p-12 text-center">
          <div className="inline-block animate-spin">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
          </div>
          <p className="mt-4 text-gray-600">Loading distribution history...</p>
        </div>
      ) : filteredData?.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">From</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">To</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Points</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {format(parseISO(entry.created_at), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {entry.from_user_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {entry.to_user_name}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-right text-green-600">
                    +{entry.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      entry.transaction_type === 'RECOGNITION'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {entry.transaction_type === 'RECOGNITION' ? 'Recognition' : 'Delegation'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {entry.description ? entry.description.substring(0, 40) + '...' : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-12 text-center">
          <p className="text-gray-600">No distributions found in this period.</p>
        </div>
      )}
    </div>
  )
}

/**
 * ============================================================================
 * 3. EMPLOYEE WALLET LEDGER
 * ============================================================================
 * Shows personal wallet transaction history for an employee
 */

export function EmployeeWalletLedger() {
  const [dateRange, setDateRange] = useState('all')
  const [filterSource, setFilterSource] = useState('all') // all, recognition, redemption, etc.

  // Fetch wallet ledger
  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['wallet', 'ledger', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ range: dateRange })
      const res = await fetch(`/api/wallets/me/ledger?${params}`)
      return res.json()
    }
  })

  // Fetch wallet balance
  const { data: walletData } = useQuery({
    queryKey: ['wallet', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/wallets/me')
      return res.json()
    }
  })

  const filteredLedger = filterSource === 'all'
    ? ledgerData
    : ledgerData?.filter(entry => entry.source === filterSource)

  const credits = filteredLedger?.filter(e => e.transaction_type === 'credit') || []
  const debits = filteredLedger?.filter(e => e.transaction_type === 'debit') || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-3xl font-bold">My Budget Wallet</h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
          <p className="text-blue-100 mb-2">Current Balance</p>
          <p className="text-4xl font-bold">{walletData?.balance?.toLocaleString('en-IN') || 0}</p>
          <p className="text-blue-100 text-sm mt-2">points available to redeem</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-lg">
          <p className="text-green-100 mb-2">Lifetime Earned</p>
          <p className="text-4xl font-bold">{walletData?.lifetime_earned?.toLocaleString('en-IN') || 0}</p>
          <p className="text-green-100 text-sm mt-2">total points earned</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white shadow-lg">
          <p className="text-orange-100 mb-2">Lifetime Spent</p>
          <p className="text-4xl font-bold">{walletData?.lifetime_spent?.toLocaleString('en-IN') || 0}</p>
          <p className="text-orange-100 text-sm mt-2">total points redeemed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="30days">Last 30 days</option>
              <option value="90days">Last 90 days</option>
              <option value="1year">Last year</option>
              <option value="all">All time</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source
            </label>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Sources</option>
              <option value="recognition">Recognition</option>
              <option value="redemption">Redemption</option>
              <option value="adjustment">Adjustment</option>
              <option value="expiry">Expiry</option>
            </select>
          </div>

          <div className="flex items-end">
            <button className="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2">
              <HiDownload className="w-4 h-4" />
              Download Statement
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Credits</p>
          <p className="text-xl font-bold text-green-600">+{credits.reduce((sum, e) => sum + e.points, 0).toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500">{credits.length} transactions</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Debits</p>
          <p className="text-xl font-bold text-red-600">-{debits.reduce((sum, e) => sum + e.points, 0).toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500">{debits.length} transactions</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Avg. Credit</p>
          <p className="text-xl font-bold text-blue-600">
            {credits.length > 0 ? Math.round(credits.reduce((sum, e) => sum + e.points, 0) / credits.length).toLocaleString('en-IN') : 0}
          </p>
          <p className="text-xs text-gray-500">per transaction</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Transactions</p>
          <p className="text-xl font-bold text-purple-600">{filteredLedger?.length || 0}</p>
          <p className="text-xs text-gray-500">in period</p>
        </div>
      </div>

      {/* Ledger Table */}
      {isLoading ? (
        <div className="bg-white rounded-lg p-12 text-center">
          <div className="inline-block animate-spin">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
          </div>
          <p className="mt-4 text-gray-600">Loading wallet history...</p>
        </div>
      ) : filteredLedger?.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Source</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLedger.map((entry, idx) => (
                <tr key={entry.id || idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {format(parseISO(entry.created_at), 'MMM dd, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {entry.description}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {entry.source}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-sm font-semibold text-right ${
                    entry.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {entry.transaction_type === 'credit' ? '+' : '-'}{entry.points.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-right text-blue-600">
                    {entry.balance_after.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-12 text-center">
          <p className="text-gray-600">No transactions found in this period.</p>
        </div>
      )}
    </div>
  )
}

export default {
  PlatformAdminLedger,
  TenantManagerLedger,
  EmployeeWalletLedger
}
