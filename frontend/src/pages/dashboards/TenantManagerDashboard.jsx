import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { walletsAPI, tenantsAPI, usersAPI, recognitionAPI } from '../../lib/api'
import { HiOutlineUsers, HiOutlineCurrencyDollar, HiOutlineChartBar, HiOutlineSparkles } from 'react-icons/hi'
import MorningBriefing from '../../components/MorningBriefing'

/**
 * Tenant Manager Dashboard
 * Only visible to tenant_manager role
 * Shows tenant-wide metrics, team overview, and management summary
 */
export default function TenantManagerDashboard() {
  const { user } = useAuthStore()

  const { data: tenantResponse } = useQuery({
    queryKey: ['currentTenant'],
    queryFn: () => tenantsAPI.getCurrent(),
  })

  const { data: usersResponse } = useQuery({
    queryKey: ['tenantUsers'],
    queryFn: () => usersAPI.getAll({ limit: 100 }),
  })

  const { data: walletResponse } = useQuery({
    queryKey: ['tenantWallet'],
    queryFn: () => walletsAPI.getMyWallet(),
  })

  const { data: recognitionResponse } = useQuery({
    queryKey: ['tenantRecognitions'],
    queryFn: () => recognitionAPI.getAll({ limit: 10 }),
  })

  const tenant = tenantResponse?.data
  const users = usersResponse?.data || []
  const wallet = walletResponse?.data
  const recognitions = recognitionResponse?.data || []

  const stats = [
    {
      label: 'Total Users',
      value: users.length,
      icon: HiOutlineUsers,
      color: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Budget Balance',
      value: wallet?.balance ? `$${(wallet.balance / 100).toFixed(2)}` : '$0.00',
      icon: HiOutlineCurrencyDollar,
      color: 'from-green-500 to-green-600',
    },
    {
      label: 'Recognition Given',
      value: recognitions.length,
      icon: HiOutlineSparkles,
      color: 'from-purple-500 to-purple-600',
    },
    {
      label: 'Active Departments',
      value: '—',
      icon: HiOutlineChartBar,
      color: 'from-orange-500 to-orange-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Morning Briefing */}
      <MorningBriefing />

      {/* Header */}
      <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-1">{tenant?.name || 'Tenant'}</h1>
        <p className="text-white/80">Manage your organization</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className={`bg-gradient-to-br ${stat.color} rounded-lg p-4 text-white`}>
              <div className="flex items-start justify-between mb-2">
                <Icon className="w-6 h-6 text-white/50" />
              </div>
              <p className="text-xs font-medium text-white/80">{stat.label}</p>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Users Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">User Management</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active Users</span>
              <span className="font-semibold">{users.filter(u => u.status === 'ACTIVE').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Pending Invites</span>
              <span className="font-semibold">{users.filter(u => u.status === 'PENDING_INVITE').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Users</span>
              <span className="font-semibold">{users.length}</span>
            </div>
          </div>
        </div>

        {/* Budget Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Budget Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Available</span>
              <span className="font-semibold text-green-600">${(wallet?.balance || 0) / 100}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Lifetime Earned</span>
              <span className="font-semibold">${(wallet?.lifetime_earned || 0) / 100}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Lifetime Spent</span>
              <span className="font-semibold">${(wallet?.lifetime_spent || 0) / 100}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Recent Recognition</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recognitions.slice(0, 5).map((recognition) => (
            <div key={recognition.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {recognition.from_user?.first_name} recognized {recognition.to_user?.first_name}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{recognition.message}</p>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(recognition.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
        {recognitions.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            No recognitions yet
          </div>
        )}
      </div>
    </div>
  )
}
