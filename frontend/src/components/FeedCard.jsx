import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { HiOutlineChat, HiOutlineStar, HiSparkles } from 'react-icons/hi'
import toast from 'react-hot-toast'
import { recognitionApi, recognitionAPI, engagementAPI, tenantsAPI } from '../lib/api'
import { formatCurrency } from '../lib/currency'
import { useAuthStore } from '../store/authStore'

const EMOJI_REACTIONS = [
  { type: 'like',  emoji: '👍', label: 'Like' },
  { type: 'love',  emoji: '❤️', label: 'Love' },
  { type: 'fire',  emoji: '🔥', label: 'Fire' },
  { type: 'clap',  emoji: '👏', label: 'Clap' },
]

const ADD_ON_OPTIONS = [5, 10, 25]

function getInitials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function FeedCard({ item }) {
  const [showComments, setShowComments] = useState(false)
  const [comment, setComment] = useState('')
  const [showAddOn, setShowAddOn] = useState(false)
  const [addOnMessage, setAddOnMessage] = useState('')
  const queryClient = useQueryClient()
  const { tenantContext, user } = useAuthStore()

  const { data: tenantData } = useQuery({
    queryKey: ['tenant', 'current'],
    queryFn: () => tenantsAPI.getCurrent().then(r => r.data),
    enabled: !tenantContext?.display_currency,
    staleTime: 5 * 60 * 1000,
  })

  const displayCurrency = tenantContext?.display_currency || tenantData?.display_currency || 'INR'
  const fxRate = parseFloat(tenantContext?.fx_rate || tenantData?.fx_rate) || 1.0

  // Derived flags
  const isRecognition = item.event_type === 'recognition'
  const isMilestone   = ['birthday', 'anniversary'].includes(item.event_type)
  const isChallenge   = item.event_type === 'challenge_completed'
  const recId         = item.recognition_id || item.reference_id
  const isSelf        = user?.id === item.actor_id

  // Reaction counts & current user reaction from enriched response
  const reactionsBreakdown = item.metadata?.reactions_breakdown || {}
  const userReactionType   = item.metadata?.user_reaction_type || null
  const totalAddOnPts      = item.metadata?.addon_points_total || 0

  const reactionMutation = useMutation({
    mutationFn: (type) => recognitionAPI.toggleReaction(recId, type),
    onSuccess: () => {
      queryClient.invalidateQueries(['feed'])
      queryClient.invalidateQueries(['recognition'])
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to react'),
  })

  const addOnMutation = useMutation({
    mutationFn: ({ points, message }) => recognitionAPI.addOnPoints(recId, { points, message }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['feed'])
      toast.success(`+${res.data?.points || ''} pts added to recognition!`)
      setShowAddOn(false)
      setAddOnMessage('')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to add bonus points'),
  })

  const commentMutation = useMutation({
    mutationFn: (content) => recognitionApi.addComment(recId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries(['feed'])
      setComment('')
      toast.success('Comment added!')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to add comment'),
  })

  // ── milestone card ───────────────────────────────────────────────────────
  if (isMilestone) {
    const meta = item.event_metadata || item.metadata || {}
    const isBirthday = item.event_type === 'birthday'
    return (
      <div className={`card border-l-4 ${isBirthday ? 'border-pink-400' : 'border-indigo-400'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${isBirthday ? 'bg-pink-100' : 'bg-indigo-100'}`}>
            {isBirthday ? '🎂' : '🏆'}
          </div>
          <div>
            <p className="font-medium text-sm text-gray-900">{meta.message || (isBirthday ? `Happy Birthday, ${meta.user_name}!` : `${meta.user_name} — ${meta.years}-Year Anniversary!`)}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {meta.points && <span className="text-green-600 font-medium">+{meta.points} pts · </span>}
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── challenge card ───────────────────────────────────────────────────────
  if (isChallenge) {
    const meta = item.event_metadata || item.metadata || {}
    return (
      <div className="card border-l-4 border-yellow-400">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-xl">
            {meta.badge_icon || '🎯'}
          </div>
          <div>
            <p className="font-medium text-sm text-gray-900">
              <span className="font-semibold">{item.actor_name}</span> completed a challenge!
            </p>
            <p className="text-xs text-gray-700 mt-0.5">{meta.challenge_title}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {meta.points_awarded && <span className="text-green-600 font-medium">+{meta.points_awarded} pts · </span>}
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── recognition card (default) ───────────────────────────────────────────
  const meta = item.metadata || {}
  const formattedPoints = meta.points ? formatCurrency(meta.points, displayCurrency, fxRate) : null

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-sparknode-purple rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
          {getInitials(item.actor_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900">
            <span className="font-semibold">{item.actor_name}</span>
            {' recognized '}
            <span className="font-semibold">{item.target_name}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Body */}
      {(meta.message || meta.badge_name) && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {meta.recognition_type === 'group_award' && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold uppercase tracking-wider">Group Award</span>
            )}
            {meta.recognition_type === 'ecard' && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-[10px] font-bold uppercase tracking-wider">E-Card</span>
            )}
            {meta.core_value_tag && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <HiSparkles className="w-3 h-3" /> {meta.core_value_tag}
              </span>
            )}
          </div>
          {meta.message && <p className="text-sm text-gray-700">{meta.message}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {meta.badge_name && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                <span>{meta.badge_icon && !meta.badge_icon.startsWith('/') ? meta.badge_icon : '🏆'}</span>
                {meta.badge_name}
              </span>
            )}
            {formattedPoints && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                +{formattedPoints}
              </span>
            )}
            {totalAddOnPts > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                +{totalAddOnPts} pts peer bonus
              </span>
            )}
          </div>
        </div>
      )}

      {/* Reactions + actions bar */}
      <div className="mt-3 flex items-center gap-1 border-t pt-3 flex-wrap">
        {/* Emoji reaction buttons */}
        {isRecognition && EMOJI_REACTIONS.map(({ type, emoji }) => {
          const count = reactionsBreakdown[type] || 0
          const isActive = userReactionType === type
          return (
            <button
              key={type}
              onClick={() => reactionMutation.mutate(type)}
              disabled={reactionMutation.isPending}
              title={`${emoji}`}
              className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-xs transition-colors ${
                isActive
                  ? 'bg-sparknode-purple/10 text-sparknode-purple font-semibold'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <span>{emoji}</span>
              {count > 0 && <span>{count}</span>}
            </button>
          )
        })}

        {/* Add-on points button (only for others' recognitions) */}
        {isRecognition && !isSelf && recId && (
          <button
            onClick={() => setShowAddOn(!showAddOn)}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <HiSparkles className="w-3.5 h-3.5" /> Add Points
          </button>
        )}

        {/* Comment toggle */}
        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs text-gray-500 hover:bg-gray-100 ${isRecognition && !isSelf ? '' : 'ml-auto'}`}
        >
          <HiOutlineChat className="w-4 h-4" />
          {meta.comment_count > 0 && <span>{meta.comment_count}</span>}
        </button>
      </div>

      {/* Add-on points panel */}
      {showAddOn && (
        <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
          <p className="text-xs font-medium text-indigo-800 mb-2">Boost this recognition with extra points:</p>
          <div className="flex gap-2 flex-wrap">
            {ADD_ON_OPTIONS.map(pts => (
              <button
                key={pts}
                onClick={() => addOnMutation.mutate({ points: pts, message: addOnMessage })}
                disabled={addOnMutation.isPending}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                +{pts} pts
              </button>
            ))}
          </div>
          <input
            type="text"
            value={addOnMessage}
            onChange={e => setAddOnMessage(e.target.value)}
            placeholder="Optional message..."
            maxLength={120}
            className="input text-xs mt-2 w-full"
          />
        </div>
      )}

      {/* Comments */}
      {showComments && (
        <div className="mt-3 border-t pt-3">
          {meta.comments?.map((c, idx) => (
            <div key={idx} className="flex items-start gap-2 mb-3">
              <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                {getInitials(c.user_name)}
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-gray-900">{c.user_name}</p>
                <p className="text-xs text-gray-700 mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); if (comment.trim()) commentMutation.mutate(comment.trim()) }} className="flex gap-2 mt-2">
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="input text-xs flex-1"
            />
            <button type="submit" disabled={!comment.trim() || commentMutation.isPending} className="btn-primary text-xs">
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
