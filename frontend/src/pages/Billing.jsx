import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  HiOutlineCreditCard, HiOutlineDocumentText, HiOutlineCheckCircle,
  HiOutlineExclamationCircle, HiOutlineDownload, HiOutlineRefresh,
  HiOutlineMail, HiOutlineOfficeBuilding,
} from 'react-icons/hi'
import { billingAPI, platformAPI } from '../lib/api'

const STATUS_COLORS = {
  paid:      'bg-green-100 text-green-700',
  sent:      'bg-blue-100 text-blue-700',
  pending:   'bg-yellow-100 text-yellow-700',
  overdue:   'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  void:      'bg-gray-100 text-gray-400',
}
const TIER_COLORS = {
  enterprise:    'bg-purple-100 text-purple-700',
  professional:  'bg-indigo-100 text-indigo-700',
  premium:       'bg-violet-100 text-violet-700',
  starter:       'bg-blue-100 text-blue-700',
  basic:         'bg-sky-100 text-sky-700',
  free:          'bg-gray-100 text-gray-500',
}
const fmt = (n) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Billing() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [generating, setGenerating] = useState(false)
  const [generateTenantId, setGenerateTenantId] = useState('')

  // ── Invoices ──────────────────────────────────────────────────────────────
  const { data: invoices = [], isLoading: loadingInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ['billing-invoices', statusFilter],
    queryFn: async () => {
      const params = {}
      if (statusFilter !== 'all') params.status = statusFilter
      return (await billingAPI.listInvoices(params)).data
    },
    staleTime: 30000,
  })

  // ── Tenants (subscriptions) ───────────────────────────────────────────────
  const { data: tenants = [], isLoading: loadingTenants } = useQuery({
    queryKey: ['billing-tenants'],
    queryFn: async () => (await platformAPI.getTenants({ limit: 200 })).data,
    staleTime: 60000,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (invoiceId) => billingAPI.sendInvoice(invoiceId),
    onSuccess: () => { toast.success('Invoice sent'); qc.invalidateQueries({ queryKey: ['billing-invoices'] }) },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Send failed'),
  })

  const markPaidMutation = useMutation({
    mutationFn: (invoiceId) => billingAPI.updateStatus(invoiceId, { status: 'paid' }),
    onSuccess: () => { toast.success('Marked as paid'); qc.invalidateQueries({ queryKey: ['billing-invoices'] }) },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Update failed'),
  })

  const handleGenerate = async () => {
    if (!generateTenantId) { toast.error('Select a tenant first'); return }
    setGenerating(true)
    try {
      await billingAPI.generateInvoice({ tenant_id: generateTenantId })
      toast.success('Invoice generated')
      setGenerateTenantId('')
      qc.invalidateQueries({ queryKey: ['billing-invoices'] })
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalReceived   = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
  const pendingRevenue  = invoices.filter(i => i.status === 'pending' || i.status === 'sent').reduce((s, i) => s + Number(i.total), 0)
  const overdueRevenue  = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.total), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <HiOutlineCreditCard className="w-8 h-8 text-sparknode-purple" />
            Billing & Subscriptions
          </h1>
          <p className="text-gray-600 mt-1">Manage tenant invoices, payment tracking, and subscription tiers</p>
        </div>
        {/* Generate Invoice */}
        <div className="flex items-center gap-2">
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sparknode-purple/30"
            value={generateTenantId}
            onChange={e => setGenerateTenantId(e.target.value)}
          >
            <option value="">Select tenant…</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating || !generateTenantId}
            className="flex items-center gap-1.5 px-4 py-2 bg-sparknode-purple text-white text-sm font-semibold rounded-lg hover:bg-sparknode-purple/90 disabled:opacity-50 transition-colors"
          >
            <HiOutlineDocumentText className="w-4 h-4" />
            {generating ? 'Generating…' : 'Generate Invoice'}
          </button>
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Received',  value: totalReceived,  color: 'text-green-600',  bg: 'bg-green-100',  icon: <HiOutlineCheckCircle className="w-6 h-6 text-green-600" />,      sub: `${invoices.filter(i=>i.status==='paid').length} invoices paid` },
          { label: 'Pending',         value: pendingRevenue, color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <HiOutlineDocumentText className="w-6 h-6 text-yellow-600" />,    sub: `${invoices.filter(i=>i.status==='pending'||i.status==='sent').length} invoices` },
          { label: 'Overdue',         value: overdueRevenue, color: 'text-red-600',    bg: 'bg-red-100',    icon: <HiOutlineExclamationCircle className="w-6 h-6 text-red-600" />, sub: `${invoices.filter(i=>i.status==='overdue').length} invoices` },
          { label: 'Active Tenants',  value: null,           color: 'text-blue-600',   bg: 'bg-blue-100',   icon: <HiOutlineCreditCard className="w-6 h-6 text-blue-600" />,        sub: 'All paying subscribers', count: tenants.filter(t=>t.subscription_status==='active').length },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{s.label}</p>
                {s.value !== null
                  ? <p className={`text-3xl font-bold mt-1 ${s.color}`}>${fmt(s.value)}</p>
                  : <p className={`text-3xl font-bold mt-1 ${s.color}`}>{loadingTenants ? '…' : s.count}</p>
                }
                <p className="text-xs text-gray-500 mt-2">{s.sub}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Invoices Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
            <p className="text-sm text-gray-600 mt-0.5">Track and manage tenant billing</p>
          </div>
          <button onClick={() => refetchInvoices()} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <HiOutlineRefresh className="w-4 h-4" />
          </button>
        </div>

        {/* Status Filter */}
        <div className="px-6 py-3 border-b border-gray-200 flex gap-2 flex-wrap">
          {['all', 'pending', 'sent', 'paid', 'overdue', 'void'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                statusFilter === s ? 'bg-sparknode-purple text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'All Invoices' : s}
            </button>
          ))}
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto">
          {loadingInvoices ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No invoices found.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Invoice #', 'Tenant', 'Period', 'Amount', 'Due Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono font-medium text-gray-900">{inv.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tenants.find(t => t.id === inv.tenant_id)?.name || inv.tenant_id?.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {inv.period_start} → {inv.period_end}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {inv.currency} {fmt(inv.total)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{inv.due_date || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                        {inv.status === 'paid' && <HiOutlineCheckCircle className="w-3.5 h-3.5" />}
                        {inv.status === 'overdue' && <HiOutlineExclamationCircle className="w-3.5 h-3.5" />}
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {/* PDF */}
                        <a
                          href={billingAPI.getPdfUrl(inv.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-sparknode-purple hover:underline font-medium"
                        >
                          <HiOutlineDownload className="w-3.5 h-3.5" />
                          PDF
                        </a>
                        {/* Send */}
                        {(inv.status === 'pending' || inv.status === 'overdue') && (
                          <button
                            onClick={() => sendMutation.mutate(inv.id)}
                            disabled={sendMutation.isPending}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium disabled:opacity-50"
                          >
                            <HiOutlineMail className="w-3.5 h-3.5" />
                            Send
                          </button>
                        )}
                        {/* Mark paid */}
                        {inv.status !== 'paid' && inv.status !== 'void' && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => markPaidMutation.mutate(inv.id)}
                            disabled={markPaidMutation.isPending}
                            className="flex items-center gap-1 text-xs text-green-600 hover:underline font-medium disabled:opacity-50"
                          >
                            <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Subscription Management */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Subscription Management</h2>
          <p className="text-sm text-gray-600 mt-0.5">View tenant subscription tiers and status</p>
        </div>

        <div className="overflow-x-auto">
          {loadingTenants ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading tenants…</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Tenant', 'Tier', 'Billing Cycle', 'Monthly Fee', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tenants.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sparknode-purple/10 flex items-center justify-center shrink-0">
                          <HiOutlineOfficeBuilding className="w-4 h-4 text-sparknode-purple" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${TIER_COLORS[t.subscription_tier] || 'bg-gray-100 text-gray-600'}`}>
                        {t.subscription_tier || 'free'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">{t.billing_cycle || 'monthly'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {t.billing_final_amount != null ? `$${fmt(t.billing_final_amount)}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        t.subscription_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {t.subscription_status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setGenerateTenantId(t.id)}
                        className="text-xs text-sparknode-purple hover:underline font-medium"
                      >
                        Generate Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
