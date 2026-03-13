import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campaignAPI, usersAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

const INTEREST_OPTS = [
  { value: 'high',   label: '🔥 High'   },
  { value: 'medium', label: '👍 Medium' },
  { value: 'low',    label: '❄️ Low'    },
]

const STATUS_BADGE = {
  draft:            'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  active:           'bg-green-100 text-green-700',
  closed:           'bg-blue-100 text-blue-700',
  cancelled:        'bg-red-100 text-red-700',
}

function fmt(pts) {
  return Number(pts).toLocaleString()
}

// ── Campaign Builder Wizard ──────────────────────────────────────────────────

function WizardStep1({ data, onChange, onNext, onCancel }) {
  const [form, setForm] = useState({
    title: data.title || '',
    description: data.description || '',
    venue: data.venue || '',
    campaign_type: data.campaign_type || 'exhibition',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleNext = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title is required')
    onChange(form)
    onNext()
  }

  return (
    <form onSubmit={handleNext} className="space-y-4">
      <h3 className="font-semibold text-gray-700">Step 1 — Campaign Details</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Title *</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
          placeholder="e.g. Tech Expo Booth 2026"
          value={form.title}
          onChange={e => set('title', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
          rows={3}
          placeholder="Briefly describe the event…"
          value={form.description}
          onChange={e => set('description', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Venue / Location</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
            placeholder="Hall 4B, Bombay Exhibition Centre"
            value={form.venue}
            onChange={e => set('venue', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
            value={form.campaign_type}
            onChange={e => set('campaign_type', e.target.value)}
          >
            <option value="exhibition">Exhibition / Booth</option>
            <option value="conference">Conference</option>
            <option value="roadshow">Roadshow</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onCancel} className="text-gray-600 text-sm px-4 py-2 border rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          Next →
        </button>
      </div>
    </form>
  )
}

function WizardStep2({ data, onChange, onNext, onBack }) {
  const [form, setForm] = useState({
    start_date: data.start_date || '',
    end_date: data.end_date || '',
    points_per_lead: data.points_per_lead ?? 50,
    max_leads_per_rep: data.max_leads_per_rep ?? '',
    total_budget_requested: data.total_budget_requested || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const ppl = Number(form.points_per_lead) || 0
  const budget = Number(form.total_budget_requested) || 0
  const maxLeads = budget > 0 && ppl > 0 ? Math.floor(budget / ppl) : 0

  const handleNext = (e) => {
    e.preventDefault()
    if (!form.start_date || !form.end_date) return toast.error('Dates are required')
    if (form.points_per_lead < 1) return toast.error('Points per lead must be ≥ 1')
    if (budget < 1) return toast.error('Budget is required')
    onChange(form)
    onNext()
  }

  return (
    <form onSubmit={handleNext} className="space-y-4">
      <h3 className="font-semibold text-gray-700">Step 2 — Dates & Rewards</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time *</label>
          <input
            type="datetime-local"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
            value={form.start_date}
            onChange={e => set('start_date', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time *</label>
          <input
            type="datetime-local"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
            value={form.end_date}
            onChange={e => set('end_date', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Points per Lead *</label>
          <input
            type="number"
            min="1"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
            value={form.points_per_lead}
            onChange={e => set('points_per_lead', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Leads / Rep / Day</label>
          <input
            type="number"
            min="1"
            placeholder="No limit"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
            value={form.max_leads_per_rep}
            onChange={e => set('max_leads_per_rep', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Total Budget Requested (pts) *</label>
        <input
          type="number"
          min="1"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
          placeholder="e.g. 10000"
          value={form.total_budget_requested}
          onChange={e => set('total_budget_requested', e.target.value)}
        />
        {maxLeads > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            ≈ covers <span className="font-semibold">{maxLeads.toLocaleString()}</span> leads at {ppl} pts each
          </p>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="text-gray-600 text-sm px-4 py-2 border rounded-lg hover:bg-gray-50">
          ← Back
        </button>
        <button type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          Next →
        </button>
      </div>
    </form>
  )
}

function WizardStep3({ data, onChange, onSubmit, onBack, isLoading }) {
  const [selectedIds, setSelectedIds] = useState(data.participant_ids || [])

  const { data: usersResp } = useQuery({
    queryKey: ['users-for-campaign'],
    queryFn: () => usersAPI.getAll({ limit: 200 }).then(r => r.data),
  })
  const users = Array.isArray(usersResp) ? usersResp : (usersResp?.users || usersResp?.data || [])

  const toggle = (uid) => {
    setSelectedIds(prev =>
      prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onChange({ participant_ids: selectedIds })
    onSubmit({ participant_ids: selectedIds })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-semibold text-gray-700">Step 3 — Booth Team</h3>
      <p className="text-sm text-gray-500">Select the sales/marketing reps who will work this booth. You can add more later.</p>

      <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
        {users.length === 0 && (
          <p className="p-3 text-sm text-gray-400">Loading users…</p>
        )}
        {users.map(u => (
          <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={selectedIds.includes(u.id)}
              onChange={() => toggle(u.id)}
              className="rounded text-indigo-600"
            />
            {u.avatar_url
              ? <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
              : <span className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">{u.first_name?.[0]}{u.last_name?.[0]}</span>
            }
            <span className="text-sm">{u.first_name} {u.last_name}</span>
            <span className="text-xs text-gray-400 ml-auto">{u.org_role}</span>
          </label>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="text-gray-600 text-sm px-4 py-2 border rounded-lg hover:bg-gray-50">
          ← Back
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
        >
          {isLoading ? 'Saving…' : 'Create Campaign ✓'}
        </button>
      </div>
    </form>
  )
}

// ── Main Campaign Builder Page ───────────────────────────────────────────────

export default function CampaignBuilder() {
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState(1)
  const [wizardData, setWizardData] = useState({})

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignAPI.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => campaignAPI.create(payload).then(r => r.data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      setShowWizard(false)
      setStep(1)
      setWizardData({})
      toast.success('Campaign created! Submit it for approval when ready.')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to create'),
  })

  const submitMutation = useMutation({
    mutationFn: (id) => campaignAPI.submit(id).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Submitted for approval') },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to submit'),
  })

  const mergeData = (partial) => setWizardData(prev => ({ ...prev, ...partial }))

  const finalCreate = (step3Data) => {
    mergeData(step3Data)
    const d = { ...wizardData, ...step3Data }
    const payload = {
      title: d.title,
      description: d.description || null,
      venue: d.venue || null,
      campaign_type: d.campaign_type || 'exhibition',
      start_date: d.start_date ? new Date(d.start_date).toISOString() : null,
      end_date: d.end_date ? new Date(d.end_date).toISOString() : null,
      points_per_lead: Number(d.points_per_lead),
      max_leads_per_rep: d.max_leads_per_rep ? Number(d.max_leads_per_rep) : null,
      total_budget_requested: Number(d.total_budget_requested),
      participant_ids: d.participant_ids || [],
    }
    createMutation.mutate(payload)
  }

  const canManage = ['tenant_manager', 'platform_admin'].includes(user?.org_role)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Campaigns</h2>
          <p className="text-sm text-gray-500 mt-0.5">Exhibition & booth campaigns with instant point payouts</p>
        </div>
        {canManage && (
          <button
            onClick={() => { setShowWizard(true); setStep(1); setWizardData({}) }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
          >
            + New Campaign
          </button>
        )}
      </div>

      {/* Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-5">
              {[1,2,3].map(n => (
                <div key={n} className={`flex-1 h-1.5 rounded-full transition-colors ${n <= step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
              ))}
            </div>

            {step === 1 && <WizardStep1 data={wizardData} onChange={mergeData} onNext={() => setStep(2)} onCancel={() => setShowWizard(false)} />}
            {step === 2 && <WizardStep2 data={wizardData} onChange={mergeData} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
            {step === 3 && <WizardStep3 data={wizardData} onChange={mergeData} onSubmit={finalCreate} onBack={() => setStep(2)} isLoading={createMutation.isPending} />}

            <button
              onClick={() => setShowWizard(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl"
            >×</button>
          </div>
        </div>
      )}

      {/* Campaign List */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading campaigns…</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🎪</div>
          <p className="text-gray-500 text-lg font-medium">No campaigns yet</p>
          {canManage && (
            <p className="text-sm text-gray-400 mt-1">Create your first exhibition campaign to get started</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} canManage={canManage} onSubmit={() => submitMutation.mutate(c.id)} isSubmitting={submitMutation.isPending} />
          ))}
        </div>
      )}
    </div>
  )
}

function CampaignCard({ campaign: c, canManage, onSubmit, isSubmitting }) {
  const escrowUsed = c.total_budget_requested > 0
    ? Math.round((c.points_disbursed / c.total_budget_requested) * 100)
    : 0
  const escrowPct = c.budget_escrow > 0 || c.points_disbursed > 0
    ? Math.round((c.points_disbursed / (c.budget_escrow + c.points_disbursed || 1)) * 100)
    : 0

  const start = c.start_date ? new Date(c.start_date) : null
  const end   = c.end_date   ? new Date(c.end_date)   : null

  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">{c.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] || 'bg-gray-100 text-gray-600'}`}>
              {c.status.replace('_', ' ')}
            </span>
          </div>
          {c.venue && <p className="text-sm text-gray-500">📍 {c.venue}</p>}
          {c.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{c.description}</p>}
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          <p className="text-2xl font-bold text-indigo-700">{fmt(c.points_per_lead)}</p>
          <p className="text-xs text-gray-400">pts/lead</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <Stat label="Leads" value={fmt(c.leads_rewarded)} />
        <Stat label="Disbursed" value={`${fmt(c.points_disbursed)} pts`} />
        <Stat label="Escrow" value={`${fmt(c.budget_escrow)} pts`} />
        <Stat label="Requested" value={`${fmt(c.total_budget_requested)} pts`} />
      </div>

      {/* Burn bar */}
      {(c.status === 'active' || c.status === 'closed') && c.total_budget_requested > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Escrow used</span>
            <span>{escrowPct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${escrowPct > 85 ? 'bg-red-500' : 'bg-indigo-500'}`}
              style={{ width: `${escrowPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Date range */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        {start && <span>🗓 {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>}
        {end   && <span>→ {end.toLocaleDateString()} {end.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {canManage && c.status === 'draft' && (
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="text-sm bg-yellow-500 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-600 disabled:opacity-60"
          >
            Submit for Approval
          </button>
        )}
        {c.status === 'active' && (
          <a
            href={`/campaigns/${c.id}/booth`}
            className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
          >
            🎤 Open Booth Mode
          </a>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  )
}
