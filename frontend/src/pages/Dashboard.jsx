import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { walletsAPI, recognitionAPI, feedAPI, analyticsAPI } from '../lib/api'
import { format } from 'date-fns'
import { HiOutlineSparkles, HiOutlineGift, HiOutlineTrendingUp, HiOutlineUsers } from 'react-icons/hi'
import WalletBalance from '../components/WalletBalance'
import FeedCard from '../components/FeedCard'

export default function Dashboard() {
  const { user, isPlatformOwnerUser, tenantContext } = useAuthStore()

  const isPlatformUser = isPlatformOwnerUser()

  const { data: wallet } = useQuery({
    queryKey: ['myWallet'],
    queryFn: () => walletsAPI.getMyWallet(),
  })

  const { data: stats } = useQuery({
    queryKey: ['myRecognitionStats'],
    queryFn: () => recognitionAPI.getMyStats(),
  })

  const { data: feed } = useQuery({
    queryKey: ['feed', { limit: 5 }],
    queryFn: () => feedAPI.getAll({ limit: 5 }),
  })

  const { data: platformMetrics } = useQuery({
    queryKey: ['platformMetrics', tenantContext?.tenant_id],
    queryFn: () => analyticsAPI.getMetrics({ tenant_id: tenantContext?.tenant_id }),
    enabled: isPlatformUser,
  })

  if (isPlatformUser) {
    return (
      <div className="space-y-3 sm:space-y-4 lg:space-y-5">
        <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-xl p-3 sm:p-4 lg:p-5 text-white">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-0.5">
            {tenantContext?.tenant_name || 'All Tenants'} Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-white/80">
            Sparknode Admin view with context-aware tenant insights.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          <div className="stat-card">
            <p className="text-xs sm:text-sm text-gray-500">Total Users</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{platformMetrics?.data?.total_users || 0}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs sm:text-sm text-gray-500">Recognitions</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{platformMetrics?.data?.total_recognitions || 0}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs sm:text-sm text-gray-500">Points Distributed</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{platformMetrics?.data?.total_points_distributed || 0}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs sm:text-sm text-gray-500">Redemptions</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{platformMetrics?.data?.total_redemptions || 0}</p>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6">Top Tenants by Engagement</h2>
          {platformMetrics?.data?.top_tenants_by_engagement?.length ? (
            <div className="space-y-2 sm:space-y-3">
              {platformMetrics.data.top_tenants_by_engagement.map((tenant) => (
                <div key={tenant.tenant_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border border-gray-100 rounded-lg gap-2 sm:gap-4">
                  <div>
                    <p className="font-medium text-gray-900 text-sm sm:text-base">{tenant.tenant_name}</p>
                    <p className="text-xs sm:text-sm text-gray-500">{tenant.subscription_tier}</p>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 flex-shrink-0">
                    Engagement: <span className="font-semibold">{tenant.engagement_score}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-gray-500">No tenant data available.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      {/* Welcome header */}
      <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-xl p-3 sm:p-4 lg:p-5 text-white">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-0.5">
          Welcome back, {user?.first_name}! 👋
        </h1>
        <p className="text-xs sm:text-sm text-white/80">
          Ready to recognize your colleagues today?
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <WalletBalance wallet={wallet?.data} />
        
        <div className="stat-card">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-gray-500">Recognitions Given</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1">{stats?.data?.total_given || 0}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sparknode-purple/10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <HiOutlineSparkles className="w-5 h-5 sm:w-6 sm:h-6 text-sparknode-purple" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">
            {stats?.data?.points_given || 0} points
          </p>
        </div>

        <div className="stat-card">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-gray-500">Recognitions Received</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1">{stats?.data?.total_received || 0}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sparknode-green/10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <HiOutlineTrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-sparknode-green" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">
            {stats?.data?.points_received || 0} points
          </p>
        </div>

        <div className="stat-card">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-gray-500">Top Badge</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1">
                {stats?.data?.top_badges?.[0]?.name || 'None yet'}
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sparknode-orange/10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <HiOutlineGift className="w-5 h-5 sm:w-6 sm:h-6 text-sparknode-orange" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">
            {stats?.data?.top_badges?.[0]?.count || 0} times received
          </p>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6">Recent Activity</h2>
        {feed?.data?.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {feed.data.map((item) => (
              <FeedCard key={item.id} item={item} compact />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 sm:py-8 text-gray-500">
            <HiOutlineUsers className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm sm:text-base">No recent activity</p>
            <p className="text-xs sm:text-sm">Be the first to recognize someone!</p>
          </div>
        )}
      </div>
    </div>
  )
}
