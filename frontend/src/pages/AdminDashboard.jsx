import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import {
  HiOutlineChartBar,
  HiOutlineHeart,
  HiOutlineUsers,
  HiOutlineCash,
  HiOutlineTrendingUp,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
} from 'react-icons/hi'

export default function AdminDashboard() {
  const { tenantContext } = useAuthStore()

  // Mock data for KPIs
  const kpis = [
    {
      label: 'Platform Circulation',
      value: '2.4M',
      unit: 'Total Points',
      icon: HiOutlineChartBar,
      color: 'purple',
      trend: '+8.2%',
      trendUp: true,
    },
    {
      label: 'Burn Rate',
      value: '72%',
      unit: 'Redemption Ratio',
      icon: HiOutlineCash,
      color: 'green',
      trend: 'Healthy',
      trendUp: true,
    },
    {
      label: 'Active Tenants',
      value: '24',
      unit: 'Last 30 Days',
      icon: HiOutlineUsers,
      color: 'blue',
      trend: '+3',
      trendUp: true,
    },
    {
      label: 'System Margin',
      value: '$18.5K',
      unit: 'Profit Generated',
      icon: HiOutlineHeart,
      color: 'orange',
      trend: '+12.5%',
      trendUp: true,
    },
  ]

  const tenantHealth = [
    { id: 1, name: 'Triton Energy', utilization: 85, balance: 120400, trend: 12, status: 'active' },
    { id: 2, name: 'Global Logistics', utilization: 92, balance: 1200, trend: 0, status: 'low' },
    { id: 3, name: 'TechFlow Inc', utilization: 78, balance: 45000, trend: 5, status: 'active' },
    { id: 4, name: 'Innovate Labs', utilization: 88, balance: 78900, trend: 8, status: 'active' },
    { id: 5, name: 'Digital Ventures', utilization: 75, balance: 32100, trend: -2, status: 'active' },
    { id: 6, name: 'Regional Corp', utilization: 42, balance: 15000, trend: -8, status: 'inactive' },
    { id: 7, name: 'Startup Hub', utilization: 38, balance: 8500, trend: -5, status: 'inactive' },
    { id: 8, name: 'Legacy Systems', utilization: 25, balance: 5000, trend: -12, status: 'inactive' },
    { id: 9, name: 'Mid-Market Ltd', utilization: 35, balance: 12000, trend: -3, status: 'inactive' },
    { id: 10, name: 'Enterprise Plus', utilization: 55, balance: 22000, trend: 2, status: 'active' },
  ]

  const topVendors = [
    { rank: 1, name: 'Amazon', volume: '$125.4K', percentage: 32, color: 'from-orange-400 to-orange-600' },
    { rank: 2, name: 'Swiggy', volume: '$98.2K', percentage: 25, color: 'from-orange-500 to-red-500' },
    { rank: 3, name: 'Starbucks', volume: '$72.1K', percentage: 18, color: 'from-green-400 to-green-600' },
    { rank: 4, name: 'Uber', volume: '$54.3K', percentage: 14, color: 'from-black to-gray-700' },
    { rank: 5, name: 'Flipkart', volume: '$41.5K', percentage: 11, color: 'from-blue-500 to-blue-700' },
  ]

  const commonQueries = [
    { query: 'How do I redeem my points?', count: 1240, percentage: 28 },
    { query: 'What\'s my current balance?', count: 980, percentage: 22 },
    { query: 'How do I give recognition?', count: 756, percentage: 17 },
    { query: 'What vendors are available?', count: 620, percentage: 14 },
    { query: 'How do I earn more points?', count: 485, percentage: 11 },
    { query: 'How do team budgets work?', count: 298, percentage: 7 },
    { query: 'Can I transfer points?', count: 156, percentage: 4 },
  ]

  const fulfillmentQueue = [
    { id: 1, item: 'SparkNode Coffee Mug', orders: 23, status: 'pending' },
    { id: 2, item: 'SparkNode T-Shirt', orders: 12, status: 'pending' },
    { id: 3, item: 'SparkNode Hoodie', orders: 5, status: 'shipped' },
  ]

  const getBalanceColor = (balance) => {
    if (balance < 10000) return 'text-red-600 bg-red-50'
    if (balance < 50000) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  const getBalanceBg = (balance) => {
    if (balance < 10000) return 'border-l-4 border-red-500'
    if (balance < 50000) return 'border-l-4 border-yellow-500'
    return 'border-l-4 border-green-500'
  }

  const topTenants = tenantHealth.slice(0, 5)
  const bottomTenants = tenantHealth.slice(-5).reverse()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Platform Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">
          {tenantContext?.tenant_name === 'All Tenants' 
            ? 'Global economy and engagement metrics across all tenants'
            : `Health metrics for ${tenantContext?.tenant_name}`}
        </p>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon
          const colorClasses = {
            purple: 'bg-purple-100',
            green: 'bg-green-100',
            blue: 'bg-blue-100',
            orange: 'bg-orange-100',
          }

          return (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600">{kpi.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{kpi.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{kpi.unit}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg ${colorClasses[kpi.color]} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 text-${kpi.color}-600`} />
                </div>
              </div>
              <div className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${kpi.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                {kpi.trendUp ? (
                  <HiOutlineTrendingUp className="w-4 h-4" />
                ) : (
                  <HiOutlineTrendingUp className="w-4 h-4 transform rotate-180" />
                )}
                {kpi.trend}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenant Health Grid */}
        <div className="lg:col-span-2 space-y-4">
          {/* Top Performing Tenants */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Top 5 Most Active Tenants</h2>
            </div>

            <div className="divide-y divide-gray-200">
              {topTenants.map((tenant) => (
                <div key={tenant.id} className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${getBalanceBg(tenant.balance)}`}>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{tenant.name}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <div>
                        <p className="text-xs text-gray-500">Utilization</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${tenant.utilization}%` }} />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{tenant.utilization}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-right ml-4">
                    <div>
                      <p className="text-xs text-gray-500">Master Balance</p>
                      <p className={`text-lg font-bold mt-1 px-3 py-1 rounded-lg ${getBalanceColor(tenant.balance)}`}>
                        {(tenant.balance / 1000).toFixed(0)}K pts
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Trend</p>
                      <div className={`text-lg font-bold mt-1 flex items-center gap-1 ${tenant.trend > 0 ? 'text-green-600' : tenant.trend < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {tenant.trend > 0 ? '↑' : tenant.trend < 0 ? '↓' : '↔'} {Math.abs(tenant.trend)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Performing Tenants */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Bottom 5 Least Active Tenants</h2>
              <p className="text-sm text-gray-600 mt-1">Consider reaching out to re-engage</p>
            </div>

            <div className="divide-y divide-gray-200">
              {bottomTenants.map((tenant) => (
                <div key={tenant.id} className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${getBalanceBg(tenant.balance)}`}>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{tenant.name}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <div>
                        <p className="text-xs text-gray-500">Utilization</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500" style={{ width: `${tenant.utilization}%` }} />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{tenant.utilization}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-right ml-4">
                    <div>
                      <p className="text-xs text-gray-500">Master Balance</p>
                      <p className={`text-lg font-bold mt-1 px-3 py-1 rounded-lg ${getBalanceColor(tenant.balance)}`}>
                        {(tenant.balance / 1000).toFixed(0)}K pts
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Trend</p>
                      <div className={`text-lg font-bold mt-1 flex items-center gap-1 ${tenant.trend > 0 ? 'text-green-600' : tenant.trend < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {tenant.trend > 0 ? '↑' : tenant.trend < 0 ? '↓' : '↔'} {Math.abs(tenant.trend)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Redemption Analytics */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Top Vendors</h2>
            </div>

            <div className="p-6 space-y-4">
              {topVendors.map((vendor) => (
                <div key={vendor.rank}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{vendor.rank}.</span>
                      <span className="font-medium text-gray-900">{vendor.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{vendor.volume}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${vendor.color}`}
                      style={{ width: `${vendor.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{vendor.percentage}% of total</p>
                </div>
              ))}
            </div>
          </div>

          {/* Fulfillment Queue */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <HiOutlineExclamationCircle className="w-5 h-5 text-orange-600" />
                Fulfillment Queue
              </h2>
            </div>

            <div className="p-6 space-y-3">
              {fulfillmentQueue.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div>
                    <h3 className="font-medium text-gray-900">{item.item}</h3>
                    <p className="text-sm text-gray-600 mt-1">{item.orders} orders</p>
                  </div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    item.status === 'pending'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {item.status === 'pending' ? '⏳ Pending' : '✓ Shipped'}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button className="text-sm font-medium text-sparknode-purple hover:text-opacity-80">
                View All Orders →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI & Engagement Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Common AI Queries */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Common AI Queries</h2>
            <p className="text-sm text-gray-600 mt-1">What users ask Sparky most</p>
          </div>

          <div className="p-6 space-y-3">
            {commonQueries.map((q, idx) => (
              <div key={idx}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900 flex-1 pr-2">{q.query}</p>
                  <span className="text-xs font-semibold text-gray-500 flex-shrink-0">{q.count}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sparknode-purple to-sparknode-blue"
                    style={{ width: `${q.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{q.percentage}% of conversations</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bot Success Rate */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">AI Bot Metrics</h3>
              <HiOutlineCheckCircle className="w-6 h-6 text-green-600" />
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">87%</p>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full w-87 bg-gradient-to-r from-green-400 to-green-600" style={{ width: '87%' }} />
                </div>
                <p className="text-xs text-gray-500 mt-2">Interactions that completed without escalation</p>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-600">Total Conversations</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">4,421</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Avg. Resolution Time</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">1.2m</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                <span className="text-sm font-medium text-green-900">API Uptime</span>
                <span className="text-sm font-bold text-green-600">99.9%</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                <span className="text-sm font-medium text-green-900">Database Status</span>
                <span className="text-sm font-bold text-green-600">Healthy</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <span className="text-sm font-medium text-yellow-900">Cache Performance</span>
                <span className="text-sm font-bold text-yellow-600">Optimizing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
