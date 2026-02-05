import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { walletsAPI, recognitionAPI, feedAPI } from '../lib/api'
import { HiOutlineSparkles, HiOutlineGift, HiOutlineTrendingUp, HiOutlineUsers } from 'react-icons/hi'
import WalletBalance from '../components/WalletBalance'
import FeedCard from '../components/FeedCard'
import AdminDashboard from './AdminDashboard'
import MorningBriefing from '../components/MorningBriefing'

export default function Dashboard() {
  const { user, isPlatformOwnerUser, getEffectiveRole } = useAuthStore()

  const isPlatformUser = isPlatformOwnerUser()
  const effectiveRole = getEffectiveRole()

  // For platform admins, show the admin dashboard
  if (isPlatformUser) {
    return <AdminDashboard />
  }

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

  // Check if user is a tenant manager/lead
  const isManager = effectiveRole === 'tenant_manager' || effectiveRole === 'dept_lead'

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      {/* Morning Briefing for Managers */}
      {isManager && <MorningBriefing />}

      {/* Welcome header - only for non-managers */}
      {!isManager && (
        <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-xl p-3 sm:p-4 lg:p-5 text-white">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-0.5">
            Welcome back, {user?.first_name}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-white/80">
            Ready to recognize your colleagues today?
          </p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <WalletBalance wallet={wallet?.data} />
        
        <div className="stat-card bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-white/80">Recognitions Given</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1">{stats?.data?.total_given || 0}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <HiOutlineSparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20 text-xs sm:text-sm">
            <span className="text-white/80">{stats?.data?.points_given || 0} points</span>
          </div>
        </div>

        <div className="stat-card bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-white/80">Recognitions Received</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1">{stats?.data?.total_received || 0}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <HiOutlineTrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20 text-xs sm:text-sm">
            <span className="text-white/80">{stats?.data?.points_received || 0} points</span>
          </div>
        </div>

        <div className="stat-card bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-white/80">Top Badge</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1">
                {stats?.data?.top_badges?.[0]?.name || 'None yet'}
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <HiOutlineGift className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20 text-xs sm:text-sm">
            <span className="text-white/80">{stats?.data?.top_badges?.[0]?.count || 0} times received</span>
          </div>
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
