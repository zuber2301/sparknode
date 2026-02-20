import { useState } from 'react'
import { HiOutlineCreditCard, HiOutlineDocumentText, HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineDownload } from 'react-icons/hi'

export default function Billing() {
  const [invoices, setInvoices] = useState([
    { id: 'INV-001', tenant: 'Acme Corp', amount: 5000, pointsInjected: 50000, issueDate: '2026-01-15', dueDate: '2026-02-15', status: 'paid', paidDate: '2026-02-10' },
    { id: 'INV-002', tenant: 'TechFlow Inc', amount: 8500, pointsInjected: 85000, issueDate: '2026-01-20', dueDate: '2026-02-20', status: 'pending', paidDate: null },
    { id: 'INV-003', tenant: 'Global Solutions', amount: 3200, pointsInjected: 32000, issueDate: '2026-01-10', dueDate: '2026-02-10', status: 'overdue', paidDate: null },
    { id: 'INV-004', tenant: 'Innovate Labs', amount: 6750, pointsInjected: 67500, issueDate: '2025-12-25', dueDate: '2026-01-25', status: 'paid', paidDate: '2026-01-23' },
    { id: 'INV-005', tenant: 'Digital Ventures', amount: 4200, pointsInjected: 42000, issueDate: '2026-01-25', dueDate: '2026-02-25', status: 'pending', paidDate: null },
  ])

  const [subscriptionTiers, setSubscriptionTiers] = useState([
    { id: 1, tenant: 'Acme Corp', tier: 'Premium', pointAllocation: 50000, monthlyFee: 2000, status: 'active', renewalDate: '2026-02-15' },
    { id: 2, tenant: 'TechFlow Inc', tier: 'Premium', pointAllocation: 85000, monthlyFee: 3400, status: 'active', renewalDate: '2026-02-20' },
    { id: 3, tenant: 'Global Solutions', tier: 'Standard', pointAllocation: 32000, monthlyFee: 1200, status: 'active', renewalDate: '2026-02-10' },
    { id: 4, tenant: 'Innovate Labs', tier: 'Premium', pointAllocation: 67500, monthlyFee: 2700, status: 'active', renewalDate: '2026-01-25' },
    { id: 5, tenant: 'Digital Ventures', tier: 'Standard', pointAllocation: 42000, monthlyFee: 1600, status: 'active', renewalDate: '2026-02-25' },
  ])

  const [selectedStatus, setSelectedStatus] = useState('all')

  const getStatusColor = (status) => {
    switch(status) {
      case 'paid': return 'bg-green-100 text-green-700'
      case 'pending': return 'bg-yellow-100 text-yellow-700'
      case 'overdue': return 'bg-red-100 text-red-700'
      case 'active': return 'bg-blue-100 text-blue-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusIcon = (status) => {
    switch(status) {
      case 'paid': return <HiOutlineCheckCircle className="w-4 h-4" />
      case 'overdue': return <HiOutlineExclamationCircle className="w-4 h-4" />
      default: return null
    }
  }

  const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0)
  const pendingRevenue = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.amount, 0)
  const overdueRevenue = invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0)
  const totalTenants = subscriptionTiers.length

  const filteredInvoices = selectedStatus === 'all' 
    ? invoices 
    : invoices.filter(inv => inv.status === selectedStatus)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <HiOutlineCreditCard className="w-8 h-8 text-sparknode-purple" />
          Billing & Subscriptions
        </h1>
        <p className="text-gray-600 mt-1">Manage tenant invoices, payment tracking, and subscription tiers</p>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Received</p>
              <p className="text-3xl font-bold text-green-600 mt-1">${totalRevenue.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500 mt-2">{invoices.filter(inv => inv.status === 'paid').length} invoices paid</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <HiOutlineCheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">${pendingRevenue.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500 mt-2">{invoices.filter(inv => inv.status === 'pending').length} invoices</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <HiOutlineDocumentText className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-3xl font-bold text-red-600 mt-1">${overdueRevenue.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500 mt-2">{invoices.filter(inv => inv.status === 'overdue').length} invoices</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
              <HiOutlineExclamationCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Tenants</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{totalTenants}</p>
              <p className="text-xs text-gray-500 mt-2">All paying subscribers</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <HiOutlineCreditCard className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
          <p className="text-sm text-gray-600 mt-1">Track and manage tenant billing</p>
        </div>

        {/* Status Filter */}
        <div className="px-6 py-4 border-b border-gray-200 flex gap-2 flex-wrap">
          {[
            { value: 'all', label: 'All Invoices' },
            { value: 'paid', label: 'Paid' },
            { value: 'pending', label: 'Pending' },
            { value: 'overdue', label: 'Overdue' },
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => setSelectedStatus(filter.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedStatus === filter.value
                  ? 'bg-sparknode-purple text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Points</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{invoice.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{invoice.tenant}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{invoice.pointsInjected.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">${invoice.amount.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{invoice.dueDate}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {getStatusIcon(invoice.status)}
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button className="flex items-center gap-1 text-sparknode-purple hover:text-sparknode-purple font-medium">
                      <HiOutlineDownload className="w-4 h-4" />
                      View PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscription Tiers */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Subscription Management</h2>
          <p className="text-sm text-gray-600 mt-1">View and manage tenant subscription levels</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Tier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Monthly Allocation</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Monthly Fee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Renewal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {subscriptionTiers.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{sub.tenant}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      sub.tier === 'Premium' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {sub.tier}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{sub.pointAllocation.toLocaleString('en-IN')} pts</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">${sub.monthlyFee.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{sub.renewalDate}</td>
                  <td className="px-6 py-4 text-sm">
                    <button className="text-sparknode-purple hover:text-sparknode-purple font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscription Tier Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900">Standard Tier</h3>
            <p className="text-sm text-gray-600 mt-1">For mid-size teams</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <span className="text-sm text-gray-600">Base Points/Month</span>
              <span className="font-semibold text-gray-900">30,000</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <span className="text-sm text-gray-600">Monthly Cost</span>
              <span className="font-semibold text-gray-900">$1,200</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg. Cost/Point</span>
              <span className="font-semibold text-gray-900">$0.04</span>
            </div>
          </div>
          <button className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors">
            Configure
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 border-sparknode-purple border-opacity-30 relative">
          <div className="absolute top-4 right-4 px-2 py-1 bg-sparknode-purple text-white text-xs font-semibold rounded">POPULAR</div>
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900">Premium Tier</h3>
            <p className="text-sm text-gray-600 mt-1">For growing enterprises</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <span className="text-sm text-gray-600">Base Points/Month</span>
              <span className="font-semibold text-gray-900">75,000</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <span className="text-sm text-gray-600">Monthly Cost</span>
              <span className="font-semibold text-gray-900">$2,850</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg. Cost/Point</span>
              <span className="font-semibold text-gray-900">$0.038</span>
            </div>
          </div>
          <button className="mt-4 w-full px-4 py-2 bg-sparknode-purple text-white rounded-lg font-medium hover:bg-opacity-90 transition-colors">
            Configure
          </button>
        </div>
      </div>
    </div>
  )
}
