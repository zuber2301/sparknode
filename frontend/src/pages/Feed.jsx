import { useQuery } from '@tanstack/react-query'
import { feedAPI } from '../lib/api'
import FeedCard from '../components/FeedCard'
import { HiOutlineRefresh, HiOutlineUsers } from 'react-icons/hi'

export default function Feed() {
  const { data: feed, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['feed'],
    queryFn: () => feedAPI.getAll({ limit: 50 }),
  })

  return (
    <div className="w-full max-w-4xl mx-auto px-0 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Activity Feed</h1>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="btn-primary flex items-center gap-2 justify-center sm:justify-start w-full sm:w-auto"
        >
          <HiOutlineRefresh className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3 sm:space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
              <div className="mt-4 h-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : feed?.data?.length > 0 ? (
        <div className="space-y-3 sm:space-y-4">
          {feed.data.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="card text-center py-8 sm:py-12">
          <HiOutlineUsers className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
          <p className="text-xs sm:text-sm text-gray-500">
            Be the first to recognize a colleague and start the feed!
          </p>
        </div>
      )}
    </div>
  )
}
