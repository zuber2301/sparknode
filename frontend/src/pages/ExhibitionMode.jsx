import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campaignAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

// ── Sparkle animation on success ─────────────────────────────────────────────

function SparkleOverlay({ points, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 animate-fade-in">
      {/* Confetti emoji burst */}
      <div className="text-7xl mb-4 animate-bounce">🎉</div>
      <div className="text-white text-4xl font-black tracking-tight animate-scale-in">
        +{Number(points).toLocaleString()} Points
      </div>
      <div className="text-green-300 text-xl mt-2 font-semibold">Added to Your Wallet!</div>
      <div className="mt-6 grid grid-cols-5 gap-2 text-3xl opacity-80">
        {['✨','⭐','💫','🌟','✨','⭐','💫','🌟','✨','🌟'].map((e, i) => (
          <span key={i} style={{ animationDelay: `${i * 100}ms` }} className="animate-bounce">{e}</span>
        ))}
      </div>
    </div>
  )
}

// ── Leaderboard strip ─────────────────────────────────────────────────────────

function LeaderboardStrip({ campaignId }) {
  const { data: rows = [] } = useQuery({
    queryKey: ['campaign-lb', campaignId],
    queryFn: () => campaignAPI.leaderboard(campaignId).then(r => r.data),
    refetchInterval: 20_000,
  })

  if (rows.length === 0) return null
  const TOP = rows.slice(0, 5)

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']

  return (
    <div className="bg-gradient-to-r from-indigo-700 to-purple-700 rounded-2xl p-4 mb-4 text-white">
      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200 mb-3">🏆 Live Leaderboard</p>
      <div className="space-y-2">
        {TOP.map((r, i) => (
          <div key={r.sales_rep_id} className="flex items-center gap-2 text-sm">
            <span className="text-base">{medals[i]}</span>
            {r.avatar_url
              ? <img src={r.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
              : <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">{r.rep_name?.[0]}</span>
            }
            <span className="flex-1 truncate font-medium">{r.rep_name}</span>
            <span className="font-bold">{r.leads_count} leads</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Lead entry form ───────────────────────────────────────────────────────────

const INTEREST_OPTIONS = [
  { value: 'high',   emoji: '🔥', label: 'High',   desc: 'Ready to buy / book a demo' },
  { value: 'medium', emoji: '👍', label: 'Medium',  desc: 'Evaluating options' },
  { value: 'low',    emoji: '❄️', label: 'Low',     desc: 'Just browsing' },
]

function LeadForm({ campaign, onSuccess }) {
  const [form, setForm] = useState({ visitor_name: '', visitor_email: '', visitor_phone: '', interest_level: 'medium', notes: '' })
  const [showNotes, setShowNotes] = useState(false)
  const nameRef = useRef(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: (payload) => campaignAPI.registerLead(campaign.id, payload).then(r => r.data),
    onSuccess: (data) => {
      onSuccess(data)
      setForm({ visitor_name: '', visitor_email: '', visitor_phone: '', interest_level: 'medium', notes: '' })
      setShowNotes(false)
      nameRef.current?.focus()
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 'Failed to register lead'
      if (msg.includes('already been registered') || err.response?.status === 409) {
        toast.error('⚠️ This visitor is already registered for this campaign')
      } else if (err.response?.status === 429) {
        toast.error('🛑 Daily lead cap reached for today')
      } else {
        toast.error(msg)
      }
    },
  })

  const submit = (e) => {
    e.preventDefault()
    if (!form.visitor_name.trim()) return toast.error('Visitor name is required')
    if (!form.visitor_email.trim() && !form.visitor_phone.trim()) {
      return toast.error('Email or phone number is required')
    }
    mutation.mutate(form)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Name – biggest field, front and centre */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Visitor Name *</label>
        <input
          ref={nameRef}
          autoFocus
          className="w-full border-2 rounded-xl px-4 py-3 text-base focus:border-indigo-500 outline-none transition-colors"
          placeholder="Full name"
          value={form.visitor_name}
          onChange={e => set('visitor_name', e.target.value)}
          inputMode="text"
          autoComplete="name"
        />
      </div>

      {/* Contact — email or phone */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
          <input
            className="w-full border-2 rounded-xl px-4 py-3 text-base focus:border-indigo-500 outline-none transition-colors"
            type="email"
            placeholder="visitor@co.com"
            value={form.visitor_email}
            onChange={e => set('visitor_email', e.target.value)}
            inputMode="email"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
          <input
            className="w-full border-2 rounded-xl px-4 py-3 text-base focus:border-indigo-500 outline-none transition-colors"
            type="tel"
            placeholder="+91 98765 43210"
            value={form.visitor_phone}
            onChange={e => set('visitor_phone', e.target.value)}
            inputMode="tel"
            autoComplete="tel"
          />
        </div>
      </div>

      {/* Interest level — large tap targets */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Interest Level *</label>
        <div className="grid grid-cols-3 gap-2">
          {INTEREST_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set('interest_level', opt.value)}
              className={`py-3 rounded-xl border-2 text-center transition-all ${
                form.interest_level === opt.value
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl">{opt.emoji}</div>
              <div className="text-xs font-semibold mt-1">{opt.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Optional notes toggle */}
      <button
        type="button"
        onClick={() => setShowNotes(!showNotes)}
        className="text-sm text-indigo-600 underline underline-offset-2"
      >
        {showNotes ? '− Hide notes' : '+ Add a note'}
      </button>
      {showNotes && (
        <textarea
          className="w-full border-2 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none"
          rows={2}
          placeholder="Product interest, follow-up info…"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
        />
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-2xl text-lg font-bold shadow-lg hover:opacity-90 active:scale-95 disabled:opacity-60 transition-all"
      >
        {mutation.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Registering…
          </span>
        ) : (
          <>Submit Lead &amp; Earn +{Number(campaign.points_per_lead).toLocaleString()} pts ⚡</>
        )}
      </button>
    </form>
  )
}

// ── Main Exhibition Mode page ─────────────────────────────────────────────────

export default function ExhibitionMode() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const [sparkle, setSparkle] = useState(null)   // { points, walletBalance }
  const [myLeadsCount, setMyLeadsCount] = useState(0)
  const [myPoints, setMyPoints] = useState(0)

  const { data: campaign, isLoading, error } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => campaignAPI.get(campaignId).then(r => r.data),
    refetchInterval: 60_000,
  })

  const handleSuccess = (data) => {
    setSparkle({ points: data.points_awarded, walletBalance: data.wallet_balance })
    setMyLeadsCount(c => c + 1)
    setMyPoints(p => p + Number(data.points_awarded))
    qc.invalidateQueries({ queryKey: ['campaign-lb', campaignId] })
    toast.success(data.message, { duration: 1500 })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2 animate-spin">⭐</div>
          <p>Loading campaign…</p>
        </div>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Campaign not found or access denied</p>
          <button onClick={() => navigate('/campaigns')} className="text-indigo-600 underline text-sm">
            ← Back to campaigns
          </button>
        </div>
      </div>
    )
  }

  if (campaign.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow p-6 max-w-sm w-full text-center">
          <div className="text-5xl mb-3">{campaign.status === 'closed' ? '📦' : '⏳'}</div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">{campaign.title}</h2>
          <p className="text-gray-500">
            {campaign.status === 'draft' ? 'This campaign is not yet active.' :
             campaign.status === 'pending_approval' ? 'Waiting for manager approval.' :
             campaign.status === 'closed' ? 'This campaign has ended.' :
             `Campaign status: ${campaign.status}`}
          </p>
          <button onClick={() => navigate('/campaigns')} className="mt-4 text-indigo-600 text-sm underline">
            ← Back
          </button>
        </div>
      </div>
    )
  }

  const escrowLeft = Number(campaign.budget_escrow || 0)
  const escrowPct  = campaign.total_budget_requested > 0
    ? Math.round((escrowLeft / campaign.total_budget_requested) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sparkle overlay */}
      {sparkle && (
        <SparkleOverlay points={sparkle.points} onDone={() => setSparkle(null)} />
      )}

      {/* Top banner */}
      <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-4 pt-safe-top pb-4">
        <div className="flex items-center gap-2 mb-3 pt-2">
          <button onClick={() => navigate('/campaigns')} className="text-indigo-200 text-xl">←</button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg truncate">{campaign.title}</h1>
            {campaign.venue && <p className="text-indigo-200 text-xs truncate">📍 {campaign.venue}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-black">+{Number(campaign.points_per_lead).toLocaleString()}</p>
            <p className="text-indigo-200 text-xs">pts/lead</p>
          </div>
        </div>

        {/* My session stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <p className="text-2xl font-black">{myLeadsCount}</p>
            <p className="text-indigo-200 text-xs">My Leads Today</p>
          </div>
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <p className="text-2xl font-black">{myPoints.toLocaleString()}</p>
            <p className="text-indigo-200 text-xs">Points Earned</p>
          </div>
        </div>
      </div>

      {/* Escrow remaining */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">Campaign escrow remaining</span>
          <span className="font-semibold text-gray-800">{Number(escrowLeft).toLocaleString()} pts</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${escrowPct < 20 ? 'bg-red-500' : escrowPct < 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${escrowPct}%` }}
          />
        </div>
        {escrowPct < 20 && (
          <p className="text-xs text-red-600 mt-1">⚠️ Campaign budget running low</p>
        )}
      </div>

      {/* Main content */}
      <div className="px-4 py-4 max-w-lg mx-auto">
        {/* Leaderboard */}
        <LeaderboardStrip campaignId={campaignId} />

        {/* Lead entry form */}
        <div className="bg-white rounded-2xl shadow-sm border p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">📋 Register a Visitor</h2>
          <LeadForm campaign={campaign} onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  )
}
