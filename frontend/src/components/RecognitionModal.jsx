import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HiX, HiOutlineStar, HiOutlineGift } from 'react-icons/hi'
import toast from 'react-hot-toast'
import { recognitionApi, usersApi } from '../lib/api'

export default function RecognitionModal({ isOpen, onClose }) {
  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  const [points, setPoints] = useState(10)
  const [badgeId, setBadgeId] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  
  const queryClient = useQueryClient()

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    enabled: isOpen
  })

  const { data: badges } = useQuery({
    queryKey: ['badges'],
    queryFn: recognitionApi.getBadges,
    enabled: isOpen
  })

  const recognitionMutation = useMutation({
    mutationFn: (data) => recognitionApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['feed'])
      queryClient.invalidateQueries(['wallet'])
      toast.success('Recognition sent successfully!')
      handleClose()
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to send recognition')
    }
  })

  const handleClose = () => {
    setRecipient('')
    setMessage('')
    setPoints(10)
    setBadgeId('')
    setIsPrivate(false)
    setSearchTerm('')
    onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!recipient) {
      toast.error('Please select a recipient')
      return
    }
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }
    if (points < 1) {
      toast.error('Points must be at least 1')
      return
    }

    recognitionMutation.mutate({
      recipient_id: recipient,
      message: message.trim(),
      points,
      badge_id: badgeId || undefined,
      is_private: isPrivate
    })
  }

  const filteredUsers = users?.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const selectedUser = users?.find(u => u.id === recipient)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
        
        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <HiX className="w-6 h-6" />
          </button>

          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-sparknode-purple/10 rounded-xl flex items-center justify-center">
              <HiOutlineStar className="w-5 h-5 text-sparknode-purple" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Give Recognition</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Recipient Selection */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Who are you recognizing?
              </label>
              {selectedUser ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-sparknode-purple rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {selectedUser.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedUser.name}</p>
                      <p className="text-xs text-gray-500">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecipient('')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setShowUserDropdown(true)
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    placeholder="Search by name or email..."
                    className="input-field w-full"
                  />
                  {showUserDropdown && filteredUsers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredUsers.slice(0, 10).map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setRecipient(user.id)
                            setSearchTerm('')
                            setShowUserDropdown(false)
                          }}
                          className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 text-left"
                        >
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recognition Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What did they do that was awesome?"
                rows={3}
                className="input-field w-full resize-none"
                required
              />
            </div>

            {/* Points */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Points to Award
              </label>
              <div className="flex items-center space-x-2">
                {[10, 25, 50, 100].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPoints(p)}
                    className={`px-4 py-2 rounded-lg border transition ${
                      points === p
                        ? 'bg-sparknode-purple text-white border-sparknode-purple'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-sparknode-purple'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  min={1}
                  className="input-field w-24"
                />
              </div>
            </div>

            {/* Badge Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Add a Badge (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBadgeId('')}
                  className={`px-3 py-2 rounded-lg border transition ${
                    !badgeId
                      ? 'bg-gray-100 border-gray-300'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  None
                </button>
                {badges?.map(badge => {
                  // Check if icon is emoji (not a URL path)
                  const icon = badge.icon_url || badge.icon
                  const isEmoji = icon && !icon.startsWith('/')
                  return (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => setBadgeId(badge.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition ${
                      badgeId === badge.id
                        ? 'bg-sparknode-purple/10 border-sparknode-purple'
                        : 'bg-white border-gray-200 hover:border-sparknode-purple'
                    }`}
                    title={badge.description}
                  >
                    {isEmoji ? (
                      <span className="text-lg">{icon}</span>
                    ) : icon ? (
                      <img src={icon} alt={badge.name} className="w-5 h-5" onError={(e) => e.target.style.display = 'none'} />
                    ) : (
                      <span className="text-lg">🏆</span>
                    )}
                    <span className="text-sm">{badge.name}</span>
                  </button>
                  )
                })}
              </div>
            </div>

            {/* Private Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Private Recognition</p>
                <p className="text-xs text-gray-500">Only visible to you and the recipient</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivate(!isPrivate)}
                className={`relative w-12 h-6 rounded-full transition ${
                  isPrivate ? 'bg-sparknode-purple' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${
                    isPrivate ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Submit */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recognitionMutation.isPending}
                className="btn-primary flex items-center space-x-2"
              >
                <HiOutlineGift className="w-5 h-5" />
                <span>{recognitionMutation.isPending ? 'Sending...' : 'Send Recognition'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
