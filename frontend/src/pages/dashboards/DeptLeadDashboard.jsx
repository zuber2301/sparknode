import { useQuery } from '@tanstack/react-query'
import { walletsAPI, recognitionAPI, tenantsAPI } from '../../lib/api'
import { HiOutlineUsers, HiOutlineCurrencyDollar, HiOutlineChartBar, HiOutlineSparkles } from 'react-icons/hi'
import MorningBriefing from '../../components/MorningBriefing'

/**
 * Department Lead Dashboard
 * Only visible to dept_lead role
 * Shows department-specific metrics and team management overview
 */
export default function DeptLeadDashboard() {
  const { data: walletResponse } = useQuery({
    queryKey: ['myWallet'],
    queryFn: () => walletsAPI.getMyWallet(),
  })

  const { data: teamRecognitions } = useQuery({
    queryKey: ['teamRecognitions'],
    queryFn: () => recognitionAPI.getAll({ limit: 10 }),
  })

  const { data: currentTenant } = useQuery({
    queryKey: ['currentTenant'],
    queryFn: () => tenantsAPI.getCurrent(),
  })

  const wallet = walletResponse?.data
  const recognitions = teamRecognitions?.data || []
  const tenant = currentTenant?.data

  const stats = [
    {
      label: 'Team Budget',
      value: wallet?.balance ? `$${(wallet.balance / 100).toFixed(2)}` : '$0.00',
      icon: HiOutlineCurrencyDollar,
      color: 'from-green-500 to-green-600',
    },
    {
      label: 'Team Recognitions',
      value: recognitions.length,
      icon: HiOutlineSparkles,
      color: 'from-purple-500 to-purple-600',
    },
    {
      label: 'Lifetime Budget',
      value: wallet?.lifetime_earned ? `$${(wallet.lifetime_earned / 100).toFixed(2)}` : '$0.00',
      icon: HiOutlineChartBar,
      color: 'from-blue-500 to-blue-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Morning Briefing */}
      <MorningBriefing />

      {/* Header */}
      <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-1">Department Dashboard</h1>
        <p className="text-white/80">Manage your team and budget</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Team Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Budget Summary</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Available Budget</span>
                <span className="font-semibold">${(wallet?.balance || 0) / 100}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, ((wallet?.balance || 0) / ((wallet?.lifetime_earned || 1) / 100)))}%`,
                  }}
                />
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Lifetime Earned</span>
                <span className="text-sm font-semibold">${(wallet?.lifetime_earned || 0) / 100}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Lifetime Spent</span>
                <span className="text-sm font-semibold">${(wallet?.lifetime_spent || 0) / 100}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Team Actions</h2>
          <div className="space-y-2">
            <a
              href="/team-hub"
              className="block w-full px-4 py-2 bg-sparknode-purple text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm font-medium text-center"
            >
              Manage Team
            </a>
            <a
              href="/team-distribute"
              className="block w-full px-4 py-2 bg-sparknode-purple/10 text-sparknode-purple rounded-lg hover:bg-sparknode-purple/20 transition-colors text-sm font-medium text-center"
            >
              Distribute Budget
            </a>
            <a
              href="/team-approvals"
              className="block w-full px-4 py-2 bg-sparknode-purple/10 text-sparknode-purple rounded-lg hover:bg-sparknode-purple/20 transition-colors text-sm font-medium text-center"
            >
              Approvals
            </a>
          </div>
        </div>
      </div>

      {/* Recent Team Activity */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Team Recognition Activity</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recognitions.slice(0, 5).map((recognition) => (
            <div key={recognition.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {recognition.from_user?.first_name} → {recognition.to_user?.first_name}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{recognition.message}</p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {new Date(recognition.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
        {recognitions.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            No team recognition activity yet
          </div>
        )}
      </div>
    </div>
  )
}
