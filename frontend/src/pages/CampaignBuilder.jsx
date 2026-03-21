import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campaignAPI, usersAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import ProGate from '../components/ProGate'
import toast from 'react-hot-toast'
import { HiOutlineX } from 'react-icons/hi'

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

// ── Wizard step definitions ──────────────────────────────────────────────────

const CAMPAIGN_STEPS = [
  { key: 'details', label: 'Campaign Details', desc: 'Name, type and venue'          },
  { key: 'rewards', label: 'Dates & Rewards',  desc: 'Schedule and point allocation' },
  { key: 'team',    label: 'Booth Team',        desc: 'Assign reps to this campaign' },
]

// ── Field-only step panels (no navigation buttons) ───────────────────────────

function DetailsStep({ form, set }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Title <span className="text-red-500">*</span></label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
          placeholder="e.g. Tech Expo Booth 2026"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          autoFocus
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
    </div>
  )
}

function RewardsStep({ form, set }) {
  const ppl = Number(form.points_per_lead) || 0
  const budget = Number(form.total_budget_requested) || 0
  const maxLeads = budget > 0 && ppl > 0 ? Math.floor(budget / ppl) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time <span className="text-red-500">*</span></label>
          <input
            type="datetime-local"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
            value={form.start_date}
            onChange={e => set('start_date', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time <span className="text-red-500">*</span></label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Points per Lead <span className="text-red-500">*</span></label>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Total Budget Requested (pts) <span className="text-red-500">*</span></label>
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
    </div>
  )
}

function TeamStep({ form, set }) {
  const { data: usersResp } = useQuery({
    queryKey: ['users-for-campaign'],
    queryFn: () => usersAPI.getAll({ limit: 200 }).then(r => r.data),
  })
  const users = Array.isArray(usersResp) ? usersResp : (usersResp?.users || usersResp?.data || [])

  const toggle = (uid) => {
    set('participant_ids', form.participant_ids.includes(uid)
      ? form.participant_ids.filter(x => x !== uid)
      : [...form.participant_ids, uid]
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Select the sales/marketing reps who will work this booth. You can add more later.</p>
      <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
        {users.length === 0 && (
          <p className="p-3 text-sm text-gray-400">Loading users…</p>
        )}
        {users.map(u => (
          <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={form.participant_ids.includes(u.id)}
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
    </div>
  )
}

// ── Main Campaign Builder Page ───────────────────────────────────────────────

export default function CampaignBuilder() {
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const [showWizard, setShowWizard] = useState(false)
  const [stepKey, setStepKey] = useState('details')
  const [form, setForm] = useState({
    title: '', description: '', venue: '', campaign_type: 'exhibition',
    start_date: '', end_date: '', points_per_lead: 50, max_leads_per_rep: '',
    total_budget_requested: '', participant_ids: [],
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const stepIdx = CAMPAIGN_STEPS.findIndex(s => s.key === stepKey)

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignAPI.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => campaignAPI.create(payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      setShowWizard(false)
      toast.success('Campaign created! Submit it for approval when ready.')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to create'),
  })

  const submitMutation = useMutation({
    mutationFn: (id) => campaignAPI.submit(id).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Submitted for approval') },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to submit'),
  })

  const openWizard = () => {
    setForm({ title:'', description:'', venue:'', campaign_type:'exhibition', start_date:'', end_date:'', points_per_lead:50, max_leads_per_rep:'', total_budget_requested:'', participant_ids:[] })
    setStepKey('details')
    setShowWizard(true)
  }

  const handleNext = () => {
    if (stepKey === 'details') {
      if (!form.title.trim()) return toast.error('Title is required')
      setStepKey('rewards')
    } else if (stepKey === 'rewards') {
      if (!form.start_date || !form.end_date) return toast.error('Dates are required')
      if (Number(form.points_per_lead) < 1) return toast.error('Points per lead must be ≥ 1')
      if (Number(form.total_budget_requested) < 1) return toast.error('Budget is required')
      setStepKey('team')
    } else {
      const payload = {
        title: form.title,
        description: form.description || null,
        venue: form.venue || null,
        campaign_type: form.campaign_type || 'exhibition',
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        points_per_lead: Number(form.points_per_lead),
        max_leads_per_rep: form.max_leads_per_rep ? Number(form.max_leads_per_rep) : null,
        total_budget_requested: Number(form.total_budget_requested),
        participant_ids: form.participant_ids || [],
      }
      createMutation.mutate(payload)
    }
  }

  const handleBack = () => {
    if (stepIdx === 0) setShowWizard(false)
    else setStepKey(CAMPAIGN_STEPS[stepIdx - 1].key)
  }

  const canManage = ['tenant_manager', 'platform_admin'].includes(user?.org_role)

  return (
    <ProGate feature="Sales Campaigns">
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Campaigns</h2>
          <p className="text-sm text-gray-500 mt-0.5">Exhibition & booth campaigns with instant point payouts</p>
        </div>
        {canManage && (
          <button
            onClick={openWizard}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
          >
            + New Campaign
          </button>
        )}
      </div>

      {/* Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex shadow-2xl overflow-hidden">

            {/* ── Left Nav ── */}
            <div className="w-52 bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
              <div className="px-5 pt-5 pb-3">
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Campaigns</p>
                <h2 className="text-sm font-bold text-gray-900 leading-tight mt-0.5">New Campaign</h2>
              </div>
              <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
                {CAMPAIGN_STEPS.map((s, i) => {
                  const active = stepKey === s.key
                  const done = i < stepIdx
                  return (
                    <button
                      key={s.key}
                      onClick={() => i <= stepIdx && setStepKey(s.key)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-sm transition-all ${
                        active ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        active ? 'bg-white/20 text-white' : done ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-400'
                      }`}>
                        {done ? '✓' : i + 1}
                      </span>
                      <span className="truncate font-medium">{s.label}</span>
                    </button>
                  )
                })}
              </nav>
              <div className="px-4 py-4 border-t border-gray-200">
                <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${((stepIdx + 1) / CAMPAIGN_STEPS.length) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">{stepIdx + 1} of {CAMPAIGN_STEPS.length}</p>
              </div>
            </div>

            {/* ── Right Content ── */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Step header */}
              <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-base font-semibold text-white">{CAMPAIGN_STEPS[stepIdx]?.label}</h3>
                  <p className="text-xs text-indigo-200 mt-0.5">{CAMPAIGN_STEPS[stepIdx]?.desc}</p>
                </div>
                <button onClick={() => setShowWizard(false)} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>

              {/* Step body */}
              <div className="flex-1 overflow-y-auto p-6">
                {stepKey === 'details' && <DetailsStep form={form} set={set} />}
                {stepKey === 'rewards' && <RewardsStep form={form} set={set} />}
                {stepKey === 'team'    && <TeamStep    form={form} set={set} />}
              </div>

              {/* Footer navigation */}
              <div className="flex justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0">
                <button onClick={handleBack} className="text-gray-600 text-sm px-4 py-2 border rounded-lg hover:bg-gray-50">
                  {stepIdx === 0 ? 'Cancel' : '← Back'}
                </button>
                <button
                  onClick={handleNext}
                  disabled={stepIdx === CAMPAIGN_STEPS.length - 1 && createMutation.isPending}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                >
                  {stepIdx === CAMPAIGN_STEPS.length - 1
                    ? (createMutation.isPending ? 'Saving…' : 'Create Campaign ✓')
                    : 'Next →'}
                </button>
              </div>
            </div>
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
    </ProGate>
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
