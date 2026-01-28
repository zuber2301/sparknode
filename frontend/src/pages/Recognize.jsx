import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recognitionAPI, usersAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { HiOutlineSearch, HiOutlineSparkles, HiOutlineStar } from 'react-icons/hi'
import RecognitionModal from '../components/RecognitionModal'
import FeedCard from '../components/FeedCard'

export default function Recognize() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: badges } = useQuery({
    queryKey: ['badges'],
    queryFn: () => recognitionAPI.getBadges(),
  })

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['userSearch', searchQuery],
    queryFn: () => usersAPI.search(searchQuery),
    enabled: searchQuery.length >= 2,
  })

  const { data: recentRecognitions } = useQuery({
    queryKey: ['recognitions', { user_id: user?.id }],
    queryFn: () => recognitionAPI.getAll({ limit: 10 }),
  })

  const recognitionMutation = useMutation({
    mutationFn: (data) => recognitionAPI.create(data),
    onSuccess: () => {
      toast.success('Recognition sent successfully! 🎉')
      queryClient.invalidateQueries(['recognitions'])
      queryClient.invalidateQueries(['feed'])
      queryClient.invalidateQueries(['myWallet'])
      setShowModal(false)
      setSelectedUser(null)
      setSearchQuery('')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to send recognition')
    },
  })

  const handleSelectUser = (selectedUser) => {
    setSelectedUser(selectedUser)
    setShowModal(true)
  }

  const handleSendRecognition = (data) => {
    recognitionMutation.mutate({
      to_user_id: selectedUser.id,
      ...data,
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-2xl mb-4">
          <HiOutlineSparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Recognize Someone</h1>
        <p className="text-gray-500">
          Show appreciation for your colleagues' great work
        </p>
      </div>

      {/* Search */}
      <div className="card">
        <label className="label">Search for a colleague</label>
        <div className="relative">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-12"
            placeholder="Search by name or email..."
          />
        </div>

        {/* Search results */}
        {searchQuery.length >= 2 && (
          <div className="mt-4">
            {isSearching ? (
              <div className="text-center py-4 text-gray-500">Searching...</div>
            ) : searchResults?.data?.length > 0 ? (
              <div className="space-y-2">
                {searchResults.data
                  .filter((u) => u.id !== user.id)
                  .map((searchUser) => (
                    <button
                      key={searchUser.id}
                      onClick={() => handleSelectUser(searchUser)}
                      className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-sparknode-purple hover:bg-sparknode-purple/5 transition-colors text-left"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-sparknode-purple to-sparknode-blue flex items-center justify-center text-white font-medium">
                        {searchUser.first_name[0]}{searchUser.last_name[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {searchUser.first_name} {searchUser.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{searchUser.email}</p>
                      </div>
                      <HiOutlineStar className="w-5 h-5 text-gray-400" />
                    </button>
                  ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">No users found</div>
            )}
          </div>
        )}
      </div>

      {/* Quick recognize - badges */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Available Badges</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {badges?.data?.map((badge) => (
            <div
              key={badge.id}
              className="p-4 rounded-lg border border-gray-200 text-center hover:border-sparknode-purple hover:bg-sparknode-purple/5 transition-colors"
            >
              <div className="w-12 h-12 mx-auto mb-2 bg-gradient-to-r from-sparknode-orange to-sparknode-pink rounded-full flex items-center justify-center text-white">
                <HiOutlineStar className="w-6 h-6" />
              </div>
              <p className="font-medium text-gray-900 text-sm">{badge.name}</p>
              <p className="text-xs text-gray-500">{badge.points_value} pts</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent recognitions */}
      {recentRecognitions?.data?.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Recent Recognitions</h2>
          <div className="space-y-4">
            {recentRecognitions.data.slice(0, 5).map((rec) => (
              <FeedCard key={rec.id} item={{
                id: rec.id,
                event_type: 'recognition',
                actor_name: rec.from_user_name,
                target_name: rec.to_user_name,
                metadata: { message: rec.message, points: rec.points },
                created_at: rec.created_at
              }} compact />
            ))}
          </div>
        </div>
      )}

      {/* Recognition Modal */}
      <RecognitionModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setSelectedUser(null)
        }}
        recipient={selectedUser}
        badges={badges?.data || []}
        onSubmit={handleSendRecognition}
        isLoading={recognitionMutation.isPending}
      />
    </div>
  )
}
