import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { surveysAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  HiOutlineRefresh,
  HiOutlinePlus,
  HiOutlineExclamation,
  HiOutlineTrendingUp,
  HiOutlineTrendingDown,
  HiOutlineMinus,
} from 'react-icons/hi'

// ── Mini SVG sparkline ───────────────────────────────────────────────────────
function Sparkline({ data = [], height = 40, color = '#6366f1' }) {
  if (data.length < 2) return null
  const scores = data.map(d => d.engagement_score ?? 0)
  const maxS = Math.max(...scores, 5)
  const minS = Math.min(...scores, 0)
  const range = maxS - minS || 1
  const w = 280
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w
    const y = height - ((s - minS) / range) * (height - 8) - 4
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((pt, i) => {
        const [x, y] = pt.split(',').map(Number)
        return (
          <circle
            key={i}
            cx={x} cy={y} r="3"
            fill={color}
            opacity="0.8"
          />
        )
      })}
    </svg>
  )
}

// ── Engagement score donut ───────────────────────────────────────────────────
function ScoreGauge({ score, maxScore = 5, size = 80 }) {
  if (score == null) return <p className="text-2xl font-bold text-gray-400">—</p>
  const pct = Math.min(score / maxScore, 1)
  const r = 28
  const circ = 2 * Math.PI * r
  const color = score >= 4 ? '#22c55e' : score >= 3 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#1f2937" strokeWidth="7" />
      <circle
        cx="32" cy="32" r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={`${pct * circ} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
      />
      <text
        x="32" y="37"
        textAnchor="middle"
        fontSize="13"
        fontWeight="bold"
        fill={color}
      >
        {score.toFixed(1)}
      </text>
    </svg>
  )
}

// ── Create Survey Modal ──────────────────────────────────────────────────────
function CreateSurveyModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    target_department: '',
    nps_enabled: false,
    closes_in_days: 7,
    extra_questions: [''],
  })

  const mutation = useMutation({
    mutationFn: () =>
      surveysAPI.createPulse({
        title: form.title || undefined,
        target_department: form.target_department || undefined,
        nps_enabled: form.nps_enabled,
        closes_in_days: Number(form.closes_in_days),
        extra_questions: form.extra_questions.filter(q => q.trim()),
      }),
    onSuccess: (res) => {
      toast.success(`Survey "${res.data.title}" created!`)
      onCreated()
      onClose()
    },
    onError: (err) => toast.error(err?.response?.data?.detail || 'Failed to create survey'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Create Pulse Survey</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Title</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Weekly Engagement Pulse"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Target Department (blank = company-wide)</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Engineering, Marketing, etc."
              value={form.target_department}
              onChange={e => setForm(f => ({ ...f, target_department: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="nps"
                checked={form.nps_enabled}
                onChange={e => setForm(f => ({ ...f, nps_enabled: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="nps" className="text-sm text-gray-700">Include NPS question</label>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs font-medium text-gray-600">Closes in</label>
              <select
                value={form.closes_in_days}
                onChange={e => setForm(f => ({ ...f, closes_in_days: e.target.value }))}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                {[3, 5, 7, 14].map(n => <option key={n} value={n}>{n} days</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Extra open-ended questions (optional)</label>
            {form.extra_questions.map((q, i) => (
              <input
                key={i}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mb-1.5"
                placeholder={`Question ${i + 1}`}
                value={q}
                onChange={e => {
                  const qs = [...form.extra_questions]
                  qs[i] = e.target.value
                  setForm(f => ({ ...f, extra_questions: qs }))
                }}
              />
            ))}
            {form.extra_questions.length < 5 && (
              <button
                className="text-xs text-indigo-600 hover:underline"
                onClick={() => setForm(f => ({ ...f, extra_questions: [...f.extra_questions, ''] }))}
              >
                + Add question
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating…' : 'Create Survey'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function EngagementDashboard() {
  const { user } = useAuthStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const qc = useQueryClient()

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['engagement-trends'],
    queryFn: () => surveysAPI.engagementTrends({ weeks: 12 }),
    select: r => r.data,
  })

  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ['engagement-results'],
    queryFn: () => surveysAPI.results({}),
    select: r => r.data,
  })

  const { data: surveysData } = useQuery({
    queryKey: ['surveys-list'],
    queryFn: () => surveysAPI.list({}),
    select: r => r.data,
  })

  const trends = trendsData?.data || []
  const direction = trendsData?.direction || 'stable'
  const latestScore = trends.length ? trends[trends.length - 1]?.engagement_score : null
  const lowEngTeams = resultsData?.low_engagement_departments || []

  const DirectionIcon = direction === 'improving' ? HiOutlineTrendingUp
    : direction === 'declining' ? HiOutlineTrendingDown
    : HiOutlineMinus

  const dirColor = direction === 'improving' ? 'text-green-600'
    : direction === 'declining' ? 'text-red-600'
    : 'text-gray-500'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Engagement Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Weekly pulse surveys → engagement score trends</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <HiOutlinePlus className="w-4 h-4" />
          New Pulse Survey
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Overall score */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <ScoreGauge score={latestScore} />
          <div>
            <p className="text-xs text-gray-500">Latest Engagement</p>
            <p className="text-xs font-medium text-gray-400">Score / 5</p>
          </div>
        </div>

        {/* NPS */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">NPS Score</p>
          <p className={`text-2xl font-bold ${
            resultsData?.nps_score == null ? 'text-gray-400'
              : resultsData.nps_score >= 50 ? 'text-green-600'
              : resultsData.nps_score >= 0 ? 'text-amber-600'
              : 'text-red-600'
          }`}>
            {resultsData?.nps_score != null
              ? `${resultsData.nps_score > 0 ? '+' : ''}${resultsData.nps_score}`
              : '—'}
          </p>
        </div>

        {/* Direction */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Trend</p>
          <div className="flex items-center gap-1">
            <DirectionIcon className={`w-6 h-6 ${dirColor}`} />
            <p className={`text-sm font-semibold capitalize ${dirColor}`}>{direction}</p>
          </div>
        </div>

        {/* Total responses */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Surveys run</p>
          <p className="text-2xl font-bold text-gray-900">{surveysData?.length ?? 0}</p>
        </div>
      </div>

      {/* Engagement trend chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Engagement Score Trend</h2>
          <span className="text-xs text-gray-400">Last {trends.length} surveys</span>
        </div>
        {trendsLoading ? (
          <div className="h-10 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : trends.length < 2 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Run at least 2 surveys to see the trend chart.
          </p>
        ) : (
          <div>
            <Sparkline data={trends} height={60} color="#6366f1" />
            <div className="flex justify-between mt-1">
              {trends.map((t, i) => (
                <span key={i} className="text-[10px] text-gray-400 flex-1 text-center truncate">
                  {t.week}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Low engagement alert */}
      {lowEngTeams.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <HiOutlineExclamation className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">
              {lowEngTeams.length} team{lowEngTeams.length > 1 ? 's' : ''} with low engagement — consider a recognition push
            </h2>
          </div>
          <div className="space-y-2">
            {lowEngTeams.map((dept, i) => (
              <div key={i} className="flex items-center justify-between bg-white border border-amber-100 rounded-lg px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{dept.department}</p>
                  <p className="text-xs text-gray-500">{dept.respondents} respondent{dept.respondents !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-red-600">{dept.engagement_score}/5</span>
                  <button
                    onClick={() => window.location.href = '/recognize'}
                    className="text-xs bg-amber-600 text-white px-3 py-1 rounded-lg hover:bg-amber-700"
                  >
                    Recognise Team →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Department breakdown */}
      {resultsData?.by_department?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            By Department — {resultsData.title}
          </h2>
          <div className="space-y-2">
            {resultsData.by_department.map((dept, i) => {
              const pct = (dept.engagement_score || 0) / 5 * 100
              const color = dept.engagement_score >= 4 ? 'bg-green-500'
                : dept.engagement_score >= 3 ? 'bg-amber-500'
                : 'bg-red-500'
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium text-gray-800">{dept.department}</span>
                    <span className="text-gray-500">{dept.engagement_score?.toFixed(1) ?? '—'}/5 · {dept.respondents} resp.</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent comments */}
      {resultsData?.recent_comments?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Anonymous Comments</h2>
          <div className="space-y-2">
            {resultsData.recent_comments.slice(0, 8).map((comment, i) => (
              <blockquote key={i} className="text-sm text-gray-600 italic border-l-2 border-indigo-200 pl-3">
                "{comment}"
              </blockquote>
            ))}
          </div>
        </div>
      )}

      {/* Survey list */}
      {surveysData?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">All Surveys</h2>
          <div className="space-y-1.5">
            {surveysData.map(s => (
              <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-400">
                    {s.target_department || 'Company-wide'} · {s.response_count} resp.
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  s.status === 'active' ? 'bg-green-100 text-green-700'
                    : s.status === 'closed' ? 'bg-gray-100 text-gray-600'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateSurveyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['surveys-list'] })}
        />
      )}
    </div>
  )
}
