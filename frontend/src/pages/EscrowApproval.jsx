import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campaignAPI, tenantsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import ProGate from '../components/ProGate'
import toast from 'react-hot-toast'

const STATUS_BADGE = {
  draft:            'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  active:           'bg-green-100 text-green-800',
  closed:           'bg-blue-100 text-blue-700',
  cancelled:        'bg-red-100 text-red-700',
}

function fmt(n) { return Number(n || 0).toLocaleString() }

function EscrowCard({ campaign: c, onApprove, onReject, tenantBalance, isProcessing }) {
  const [rejectMode, setRejectMode] = useState(false)
  const [reason, setReason] = useState('')

  const canAfford = tenantBalance !== null ? Number(c.total_budget_requested) <= Number(tenantBalance) : true

  return (
    <div className="bg-white border-2 border-yellow-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-yellow-600">⏳</span>
            <h3 className="font-semibold text-gray-900">{c.title}</h3>
          </div>
          {c.venue && <p className="text-sm text-gray-500">📍 {c.venue}</p>}
          {c.description && <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{c.description}</p>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE.pending_approval}`}>
          Pending Approval
        </span>
      </div>

      {/* Financial breakdown */}
      <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-4">
        <p className="text-sm font-semibold text-amber-800 mb-2">💰 Escrow Request</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-amber-600">Points Requested</p>
            <p className="text-lg font-bold text-amber-900">{fmt(c.total_budget_requested)}</p>
          </div>
          <div>
            <p className="text-xs text-amber-600">Per Lead</p>
            <p className="text-lg font-bold text-amber-900">{fmt(c.points_per_lead)} pts</p>
          </div>
          <div>
            <p className="text-xs text-amber-600">Max Leads</p>
            <p className="text-lg font-bold text-amber-900">
              {fmt(Math.floor(c.total_budget_requested / c.points_per_lead))}
            </p>
          </div>
        </div>

        {tenantBalance !== null && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${canAfford ? 'text-green-700' : 'text-red-700'}`}>
            {canAfford
              ? <span>✅ Master pool has {fmt(tenantBalance)} pts — sufficient</span>
              : <span>❌ Insufficient! Master pool has {fmt(tenantBalance)} pts (need {fmt(c.total_budget_requested)})</span>
            }
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="flex gap-6 text-sm text-gray-600 mb-4">
        <span>🗓 {new Date(c.start_date).toLocaleDateString()} {new Date(c.start_date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
        <span>→ {new Date(c.end_date).toLocaleDateString()} {new Date(c.end_date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
      </div>

      {/* Participants */}
      {c.participants?.length > 0 && (
        <p className="text-sm text-gray-500 mb-4">
          👥 {c.participants.length} booth rep{c.participants.length !== 1 ? 's' : ''} assigned
        </p>
      )}

      {/* Actions */}
      {!rejectMode ? (
        <div className="flex gap-3">
          <button
            disabled={isProcessing || !canAfford}
            onClick={() => onApprove(c.id)}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {isProcessing ? '…' : '✅ Approve & Escrow Points'}
          </button>
          <button
            disabled={isProcessing}
            onClick={() => setRejectMode(true)}
            className="flex-1 bg-red-50 text-red-700 border border-red-200 py-2 rounded-lg text-sm font-medium hover:bg-red-100"
          >
            ✖ Reject
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-300 outline-none"
            rows={2}
            placeholder="Reason for rejection (optional)…"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => { onReject(c.id, reason); setRejectMode(false) }}
              disabled={isProcessing}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
            >
              Confirm Rejection
            </button>
            <button onClick={() => setRejectMode(false)} className="px-4 py-2 text-gray-600 text-sm border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ActiveCampaignRow({ c }) {
  const escrowPct = c.total_budget_requested > 0
    ? Math.round(((c.total_budget_requested - c.budget_escrow) / c.total_budget_requested) * 100)
    : 0

  return (
    <div className="bg-white border rounded-xl p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] || ''}`}>
            {c.status}
          </span>
          <h4 className="font-medium text-gray-900 truncate">{c.title}</h4>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${escrowPct > 85 ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${escrowPct}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-20 text-right">{escrowPct}% used</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-bold text-gray-800">{fmt(c.leads_rewarded)} leads</p>
        <p className="text-xs text-gray-400">{fmt(c.points_disbursed)} pts disbursed</p>
      </div>
    </div>
  )
}

export default function EscrowApproval() {
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['campaigns-pending'],
    queryFn: () => campaignAPI.pendingApprovals().then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: allCampaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignAPI.list().then(r => r.data),
  })

  const { data: tenantResp } = useQuery({
    queryKey: ['currentTenant'],
    queryFn: () => tenantsAPI.getCurrent().then(r => r.data),
    staleTime: 60_000,
  })
  const tenantBalance = tenantResp?.master_budget_balance ?? null

  const approveMutation = useMutation({
    mutationFn: (id) => campaignAPI.approve(id, { approved: true }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns-pending'] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      qc.invalidateQueries({ queryKey: ['currentTenant'] })
      toast.success('Campaign approved — escrow locked in!')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Approval failed'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => campaignAPI.approve(id, { approved: false, rejection_reason: reason }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns-pending'] })
      toast.success('Campaign returned to draft')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Rejection failed'),
  })

  const activeCampaigns = allCampaigns.filter(c => c.status === 'active')
  const closedCampaigns = allCampaigns.filter(c => c.status === 'closed')

  const isProcessing = approveMutation.isPending || rejectMutation.isPending

  return (
    <ProGate feature="Campaign Escrow">
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Campaign Escrow</h2>
        <p className="text-sm text-gray-500 mt-0.5">Review and approve campaign budget requests from your team</p>
      </div>

      {/* Master pool balance */}
      {tenantBalance !== null && (
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm">Master Pool Balance</p>
            <p className="text-3xl font-bold">{fmt(tenantBalance)} pts</p>
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-sm">Pending requests</p>
            <p className="text-2xl font-bold">{fmt(pending.reduce((s, c) => s + Number(c.total_budget_requested), 0))} pts</p>
          </div>
        </div>
      )}

      {/* Pending approvals */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          ⏳ Pending Approval
          {pending.length > 0 && (
            <span className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">{pending.length}</span>
          )}
        </h3>
        {pendingLoading ? (
          <div className="text-gray-400 py-4 text-center">Loading…</div>
        ) : pending.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl py-8 text-center text-gray-400">
            <p className="text-2xl mb-1">✅</p>
            <p className="text-sm">No pending approvals</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pending.map(c => (
              <EscrowCard
                key={c.id}
                campaign={c}
                tenantBalance={tenantBalance}
                isProcessing={isProcessing}
                onApprove={(id) => approveMutation.mutate(id)}
                onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
              />
            ))}
          </div>
        )}
      </section>

      {/* Active campaigns */}
      {activeCampaigns.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">🟢 Active Campaigns</h3>
          <div className="grid gap-3">
            {activeCampaigns.map(c => <ActiveCampaignRow key={c.id} c={c} />)}
          </div>
        </section>
      )}

      {/* Closed / swept */}
      {closedCampaigns.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">📦 Closed Campaigns</h3>
          <div className="grid gap-3">
            {closedCampaigns.map(c => (
              <div key={c.id} className="bg-gray-50 border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-700">{c.title}</h4>
                  {c.swept_amount > 0 && (
                    <p className="text-xs text-blue-600 mt-0.5">↩ {fmt(c.swept_amount)} pts returned to master pool</p>
                  )}
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>{fmt(c.leads_rewarded)} leads · {fmt(c.points_disbursed)} pts</p>
                  {c.swept_at && <p className="text-xs">Swept {new Date(c.swept_at).toLocaleDateString()}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
    </ProGate>
  )
}
