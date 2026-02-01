import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { HiOutlineHeart, HiHeart, HiOutlineChat, HiOutlineStar } from 'react-icons/hi'
import toast from 'react-hot-toast'
import { recognitionApi, tenantsAPI } from '../lib/api'
import { formatCurrency } from '../lib/currency'

export default function FeedCard({ item }) {
  const [showComments, setShowComments] = useState(false)
  const [comment, setComment] = useState('')
  const queryClient = useQueryClient()

  // Fetch tenant config for currency settings
  const { data: tenantData } = useQuery({
    queryKey: ['tenant', 'current'],
    queryFn: () => tenantsAPI.getCurrentTenant()
  })

  const reactionMutation = useMutation({
    mutationFn: (type) => recognitionApi.addReaction(item.recognition_id, type),
    onSuccess: () => {
      queryClient.invalidateQueries(['feed'])
      queryClient.invalidateQueries(['recognition'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to add reaction')
    }
  })

  const commentMutation = useMutation({
    mutationFn: (content) => recognitionApi.addComment(item.recognition_id, content),
    onSuccess: () => {
      queryClient.invalidateQueries(['feed'])
      queryClient.invalidateQueries(['recognition'])
      setComment('')
      toast.success('Comment added!')
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to add comment')
    }
  })

  const handleReaction = (type) => {
    reactionMutation.mutate(type)
  }

  const handleComment = (e) => {
    e.preventDefault()
    if (comment.trim()) {
      commentMutation.mutate(comment.trim())
    }
  }

  const getEventIcon = () => {
    switch (item.event_type) {
      case 'recognition':
        return <HiOutlineStar className="w-5 h-5 text-yellow-500" />
      default:
        return <HiOutlineStar className="w-5 h-5 text-gray-400" />
    }
  }

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase() || '?'
  }

  // Get currency display settings
  const displayCurrency = tenantData?.display_currency || 'USD'
  const fxRate = parseFloat(tenantData?.fx_rate) || 1.0
  const formattedPoints = item.metadata?.points
    ? formatCurrency(item.metadata.points, displayCurrency, fxRate)
    : null

  return (
    <div className="card">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-sparknode-purple rounded-full flex items-center justify-center text-white font-medium text-xs sm:text-sm flex-shrink-0">
          {getInitials(item.actor_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            {getEventIcon()}
            <p className="text-xs sm:text-sm text-gray-900">
              <span className="font-medium">{item.actor_name}</span>
              <span className="hidden sm:inline">{' recognized '}</span>
              <span className="block sm:inline"><span className="font-medium">{item.target_name}</span></span>
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {item.metadata?.message && (
        <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
          <p className="text-xs sm:text-sm text-gray-700">{item.metadata.message}</p>
          {item.metadata?.badge_name && (
            <div className="mt-2 inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
              {item.metadata.badge_icon && !item.metadata.badge_icon.startsWith('/') ? (
                <span className="text-sm sm:text-base">{item.metadata.badge_icon}</span>
              ) : (
                <span className="text-sm sm:text-base">🏆</span>
              )}
              <span className="text-xs sm:text-sm">{item.metadata.badge_name}</span>
            </div>
          )}
          {formattedPoints && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              +{formattedPoints}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 sm:mt-4 flex items-center gap-3 sm:gap-4 border-t pt-3 sm:pt-4">
        <button
          onClick={() => handleReaction('like')}
          className={`flex items-center gap-1 text-xs sm:text-sm flex-shrink-0 ${
            item.metadata?.liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
          }`}
          disabled={reactionMutation.isPending}
        >
          {item.metadata?.liked ? (
            <HiHeart className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <HiOutlineHeart className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
          <span className="hidden sm:inline">{item.metadata?.like_count || 0}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 hover:text-sparknode-purple flex-shrink-0"
        >
          <HiOutlineChat className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">{item.metadata?.comment_count || 0}</span>
        </button>
      </div>

      {showComments && (
        <div className="mt-3 sm:mt-4 border-t pt-3 sm:pt-4">
          {item.metadata?.comments?.map((c, idx) => (
            <div key={idx} className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                {getInitials(c.user_name)}
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg p-2 sm:p-3 min-w-0">
                <p className="text-xs font-medium text-gray-900">{c.user_name}</p>
                <p className="text-xs sm:text-sm text-gray-700 mt-1">{c.content}</p>
              </div>
            </div>
          ))}

          <form onSubmit={handleComment} className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 sm:mt-4">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="input text-xs sm:text-sm flex-1"
            />
            <button
              type="submit"
              disabled={!comment.trim() || commentMutation.isPending}
              className="btn-primary text-xs sm:text-sm whitespace-nowrap"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
