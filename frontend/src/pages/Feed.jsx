import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { feedAPI } from '../lib/api'
import FeedCard from '../components/FeedCard'
import RecognitionModal from '../components/RecognitionModal'
import { HiOutlineRefresh, HiOutlineStar } from 'react-icons/hi'

const TABS = [
  { id: 'all',        label: 'All' },
  { id: 'recognition',label: '🏆 Awards' },
  { id: 'ecard',      label: '💌 E-Cards' },
  { id: 'birthday',   label: '🎂 Birthdays' },
  { id: 'anniversary',label: '🎉 Anniversaries' },
  { id: 'challenge_completed', label: '🎯 Challenges' },
]

export default function Feed() {
  const [activeTab, setActiveTab] = useState('all')
  const [showRecognitionModal, setShowRecognitionModal] = useState(false)

  const { data: feed, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['feed'],
    queryFn: () => feedAPI.getAll({ limit: 100 }),
    staleTime: 30 * 1000,
  })

  const allItems = feed?.data || []

  const filteredItems = activeTab === 'all'
    ? allItems
    : allItems.filter(item => {
        if (activeTab === 'recognition') return item.event_type === 'recognition' && item.metadata?.recognition_type !== 'ecard'
        if (activeTab === 'ecard') return item.event_type === 'recognition' && item.metadata?.recognition_type === 'ecard'
        return item.event_type === activeTab
      })

  return (
    <div className="w-full max-w-4xl mx-auto px-0 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Activity Feed</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRecognitionModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <HiOutlineStar className="w-4 h-4" />
            Recognize Someone
          </button>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="btn-secondary flex items-center gap-2"
            title="Refresh"
          >
            <HiOutlineRefresh className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-sparknode-purple text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            {tab.id !== 'all' && allItems.filter(i => {
              if (tab.id === 'recognition') return i.event_type === 'recognition' && i.metadata?.recognition_type !== 'ecard'
              if (tab.id === 'ecard') return i.event_type === 'recognition' && i.metadata?.recognition_type === 'ecard'
              return i.event_type === tab.id
            }).length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">
                {allItems.filter(i => {
                  if (tab.id === 'recognition') return i.event_type === 'recognition' && i.metadata?.recognition_type !== 'ecard'
                  if (tab.id === 'ecard') return i.event_type === 'recognition' && i.metadata?.recognition_type === 'ecard'
                  return i.event_type === tab.id
                }).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Feed content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
              <div className="mt-4 h-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="space-y-3 sm:space-y-4">
          {filteredItems.map(item => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="card text-center py-10 sm:py-16">
          <div className="text-6xl mb-5">
            {activeTab === 'all' ? '🤝' : activeTab === 'recognition' ? '🏆' : activeTab === 'ecard' ? '💌' : activeTab === 'birthday' ? '🎂' : activeTab === 'anniversary' ? '🎉' : '🎯'}
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
            {activeTab === 'all' ? 'The feed is quiet for now' : 'Nothing here yet'}
          </h3>
          <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
            {activeTab === 'all'
              ? 'Be the first to recognize a colleague and get the celebration started!'
              : `No ${TABS.find(t => t.id === activeTab)?.label} posts yet. Check back soon.`}
          </p>
          {activeTab === 'all' && (
            <button
              onClick={() => setShowRecognitionModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <HiOutlineStar className="w-4 h-4" />
              Send First Recognition
            </button>
          )}
        </div>
      )}

      <RecognitionModal
        isOpen={showRecognitionModal}
        onClose={() => setShowRecognitionModal(false)}
      />
    </div>
  )
}
