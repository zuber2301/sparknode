import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { HiOutlineHeart, HiHeart, HiOutlineChat, HiOutlineStar } from 'react-icons/hi'
import toast from 'react-hot-toast'
import { recognitionApi } from '../lib/api'

export default function FeedCard({ item }) {
  const [showComments, setShowComments] = useState(false)
  const [comment, setComment] = useState('')
  const queryClient = useQueryClient()

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

  return (
    <div className="card">
      <div className="flex items-start space-x-4">
        <div className="w-10 h-10 bg-sparknode-purple rounded-full flex items-center justify-center text-white font-medium">
          {getInitials(item.actor_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            {getEventIcon()}
            <p className="text-sm text-gray-900">
              <span className="font-medium">{item.actor_name}</span>
              {' recognized '}
              <span className="font-medium">{item.target_name}</span>
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {item.metadata?.message && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-700">{item.metadata.message}</p>
          {item.metadata?.badge_name && (
            <div className="mt-2 inline-flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
              {item.metadata.badge_icon && !item.metadata.badge_icon.startsWith('/') ? (
                <span className="text-lg">{item.metadata.badge_icon}</span>
              ) : (
                <span className="text-lg">🏆</span>
              )}
              <span>{item.metadata.badge_name}</span>
            </div>
          )}
          {item.metadata?.points && (
            <span className="ml-2 inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              +{item.metadata.points} points
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center space-x-4 border-t pt-4">
        <button
          onClick={() => handleReaction('like')}
          className={`flex items-center space-x-1 text-sm ${
            item.metadata?.liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
          }`}
          disabled={reactionMutation.isPending}
        >
          {item.metadata?.liked ? (
            <HiHeart className="w-5 h-5" />
          ) : (
            <HiOutlineHeart className="w-5 h-5" />
          )}
          <span>{item.metadata?.like_count || 0}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center space-x-1 text-sm text-gray-500 hover:text-sparknode-purple"
        >
          <HiOutlineChat className="w-5 h-5" />
          <span>{item.metadata?.comment_count || 0}</span>
        </button>
      </div>

      {showComments && (
        <div className="mt-4 border-t pt-4">
          {item.metadata?.comments?.map((c, idx) => (
            <div key={idx} className="flex items-start space-x-3 mb-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium">
                {getInitials(c.user_name)}
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg p-2">
                <p className="text-xs font-medium text-gray-900">{c.user_name}</p>
                <p className="text-sm text-gray-700">{c.content}</p>
              </div>
            </div>
          ))}

          <form onSubmit={handleComment} className="flex items-center space-x-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="input-field flex-1"
            />
            <button
              type="submit"
              disabled={!comment.trim() || commentMutation.isPending}
              className="btn-primary"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
