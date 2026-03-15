import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { engagementAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { HiOutlinePlusSm, HiOutlineBadgeCheck, HiOutlineFire, HiOutlineClock } from 'react-icons/hi'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const CHALLENGE_TYPES = ['learning', 'wellness', 'social', 'performance', 'other']

export default function Challenges() {
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ title: '', description: '', challenge_type: 'social', points_reward: 50, badge_icon: '🎯', deadline: '' })
  const { getEffectiveRole } = useAuthStore()
  const queryClient = useQueryClient()
  const isManager = ['tenant_manager', 'dept_lead', 'platform_admin'].includes(getEffectiveRole())

  const { data: challenges, isLoading } = useQuery({
    queryKey: ['challenges'],
    queryFn: () => engagementAPI.getChallenges().then(r => r.data),
    staleTime: 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data) => engagementAPI.createChallenge(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['challenges'])
      toast.success('Challenge created!')
      setShowCreate(false)
      setForm({ title: '', description: '', challenge_type: 'social', points_reward: 50, badge_icon: '🎯', deadline: '' })
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to create challenge'),
  })

  const completeMutation = useMutation({
    mutationFn: (id) => engagementAPI.completeChallenge(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['challenges'])
      queryClient.invalidateQueries(['wallet'])
      queryClient.invalidateQueries(['feed'])
      toast.success(`🎉 Challenge complete! +${res.data?.points_awarded || ''} pts earned!`)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to complete challenge'),
  })

  const items = challenges || []
  const filtered = filter === 'all' ? items
    : filter === 'completed' ? items.filter(c => c.completed)
    : filter === 'active' ? items.filter(c => !c.completed && c.is_active)
    : items.filter(c => c.challenge_type === filter)

  const handleCreate = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title is required')
    createMutation.mutate({ ...form, points_reward: parseFloat(form.points_reward) || 0, deadline: form.deadline || null })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎯 Challenges</h1>
          <p className="text-gray-500 text-sm mt-1">Complete challenges to earn bonus points</p>
        </div>
        {isManager && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
            <HiOutlinePlusSm className="w-5 h-5" /> New Challenge
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && isManager && (
        <form onSubmit={handleCreate} className="card border-2 border-sparknode-purple/30 space-y-4">
          <h3 className="font-semibold text-gray-900">Create New Challenge</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                className="input w-full"
                placeholder="e.g. 30-day steps challenge"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Badge Icon (emoji)</label>
              <input
                className="input w-full"
                placeholder="🎯"
                value={form.badge_icon}
                onChange={e => setForm(f => ({ ...f, badge_icon: e.target.value }))}
                maxLength={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select className="input w-full" value={form.challenge_type} onChange={e => setForm(f => ({ ...f, challenge_type: e.target.value }))}>
                {CHALLENGE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points Reward</label>
              <input
                type="number"
                className="input w-full"
                value={form.points_reward}
                onChange={e => setForm(f => ({ ...f, points_reward: e.target.value }))}
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deadline (optional)</label>
              <input
                type="datetime-local"
                className="input w-full"
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="input w-full"
              rows={2}
              placeholder="Describe how to complete the challenge..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Creating...' : 'Create Challenge'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'active', 'completed', ...CHALLENGE_TYPES].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f ? 'bg-sparknode-purple text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Challenges list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse h-24" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(challenge => (
            <div key={challenge.id} className={`card flex items-start gap-4 ${challenge.completed ? 'opacity-75' : ''}`}>
              <div className="text-3xl flex-shrink-0">{challenge.badge_icon || '🎯'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{challenge.title}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-600">
                    {challenge.challenge_type}
                  </span>
                  {challenge.completed && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700 flex items-center gap-1">
                      <HiOutlineBadgeCheck className="w-3 h-3" /> Done
                    </span>
                  )}
                </div>
                {challenge.description && <p className="text-sm text-gray-600 mb-2">{challenge.description}</p>}
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="text-green-600 font-semibold flex items-center gap-1">
                    <HiOutlineFire className="w-3.5 h-3.5" />
                    +{challenge.points_reward} pts
                  </span>
                  {challenge.completions_count > 0 && (
                    <span>{challenge.completions_count} completed</span>
                  )}
                  {challenge.deadline && (
                    <span className="flex items-center gap-1">
                      <HiOutlineClock className="w-3.5 h-3.5" />
                      Ends {formatDistanceToNow(new Date(challenge.deadline), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
              {!challenge.completed && challenge.is_active && (
                <button
                  onClick={() => completeMutation.mutate(challenge.id)}
                  disabled={completeMutation.isPending}
                  className="btn-primary text-sm flex-shrink-0"
                >
                  Mark Complete
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">🎯</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No challenges yet</h3>
          <p className="text-sm text-gray-500">
            {isManager ? 'Create the first challenge for your team!' : 'Your manager will set up challenges soon.'}
          </p>
        </div>
      )}
    </div>
  )
}
