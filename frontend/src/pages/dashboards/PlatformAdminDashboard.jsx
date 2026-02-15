import { useQuery } from '@tanstack/react-query'
import { platformAPI, tenantsAPI } from '../../lib/api'
import { HiOutlineOfficeBuilding, HiOutlineUsers, HiOutlineCurrencyDollar, HiOutlineChartBar } from 'react-icons/hi'

/**
 * Platform Admin Dashboard
 * Only visible to platform_admin role
 * Shows system-wide metrics and tenant overview
 */
export default function PlatformAdminDashboard() {
  const { data: tenantsResponse } = useQuery({
    queryKey: ['platformTenants'],
    queryFn: () => platformAPI.getTenants({ limit: 100 }),
  })

  const tenants = tenantsResponse?.data || []

  const stats = [
    {
      label: 'Total Tenants',
      value: tenants.length,
      icon: HiOutlineOfficeBuilding,
      color: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Active Tenants',
      value: tenants.filter(t => t.status === 'ACTIVE').length,
      icon: HiOutlineChartBar,
      color: 'from-green-500 to-green-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Platform Administration</h1>
        <p className="text-white/80">System-wide metrics and tenant management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className={`bg-gradient-to-br ${stat.color} rounded-lg p-6 text-white`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">{stat.label}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                </div>
                <Icon className="w-8 h-8 text-white/50" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Tenants List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Tenants</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Domain</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{tenant.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{tenant.domain || '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tenant.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tenants.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            No tenants found
          </div>
        )}
      </div>
    </div>
  )
}
