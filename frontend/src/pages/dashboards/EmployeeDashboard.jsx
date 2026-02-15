import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { walletsAPI, recognitionAPI, feedAPI } from '../../lib/api'
import { HiOutlineSparkles, HiOutlineGift, HiOutlineTrendingUp } from 'react-icons/hi'
import WalletBalance from '../../components/WalletBalance'
import FeedCard from '../../components/FeedCard'

/**
 * Employee Dashboard
 * Only visible to tenant_user role (regular employees)
 * Shows personal wallet, recognition stats, and company feed
 */
export default function EmployeeDashboard() {
  const { user } = useAuthStore()

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

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-xl p-3 sm:p-4 lg:p-5 text-white">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-0.5">
          Welcome back, {user?.first_name}! 👋
        </h1>
        <p className="text-xs sm:text-sm text-white/80">
          See your recognition, balance, and company updates
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
        {/* Points Balance */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-gray-600 font-medium">Points Balance</span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <HiOutlineGift className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
            {wallet?.balance ? `$${(wallet.balance / 100).toFixed(2)}` : '$0.00'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Available to spend</p>
        </div>

        {/* Recognition Given */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-gray-600 font-medium">Given</span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <HiOutlineSparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
            {stats?.recognitions_given || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Recognition instances</p>
        </div>

        {/* Recognition Received */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-gray-600 font-medium">Received</span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <HiOutlineTrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
            {stats?.recognitions_received || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">From teammates</p>
        </div>
      </div>

      {/* Wallet Details */}
      <WalletBalance />

      {/* Company Feed */}
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between px-1 sm:px-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Company Recognition Feed</h2>
          <a
            href="/feed"
            className="text-xs sm:text-sm text-sparknode-purple hover:text-sparknode-purple/80 font-medium"
          >
            View all
          </a>
        </div>
        <div className="space-y-2 sm:space-y-3">
          {feed && feed.length > 0 ? (
            feed.map((item) => <FeedCard key={item.id} item={item} />)
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <HiOutlineSparkles className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No recognition yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-sparknode-purple/10 to-sparknode-blue/10 border border-sparknode-purple border-opacity-20 rounded-lg p-4 sm:p-5">
        <h3 className="font-semibold text-gray-900 mb-2">Recognize a colleague</h3>
        <p className="text-sm text-gray-600 mb-4">
          Let your teammates know how much you value their contributions
        </p>
        <a
          href="/recognize"
          className="inline-flex items-center gap-2 px-4 py-2 bg-sparknode-purple text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm font-medium"
        >
          <HiOutlineSparkles className="w-4 h-4" />
          Give Recognition
        </a>
      </div>
    </div>
  )
}
