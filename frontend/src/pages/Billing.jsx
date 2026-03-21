import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  HiOutlineCreditCard, HiOutlineDocumentText, HiOutlineCheckCircle,
  HiOutlineExclamationCircle, HiOutlineDownload, HiOutlineRefresh,
  HiOutlineMail, HiOutlineOfficeBuilding, HiOutlinePlusCircle,
  HiOutlineX, HiOutlineBan, HiOutlineSearch,
  HiOutlineCalendar,
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

const fmt = (n, currency) => {
  const num = Number(n ?? 0)
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const fmtCurrency = (n, currency = 'INR') => `${currency} ${fmt(n)}`

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function formatPeriod(start, end) {
  if (!start) return '—'
  const d = new Date(start + 'T00:00:00')
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// ── Generate Invoice Modal ────────────────────────────────────────────────────
function GenerateInvoiceModal({ tenants, initialTenantId, onClose, onSuccess }) {
  const currentDate = new Date()
  const [tenantId, setTenantId] = useState(initialTenantId || '')
  const [tenantSearch, setTenantSearch] = useState('')
  const [month, setMonth] = useState(currentDate.getMonth() + 1)
  const [year, setYear] = useState(currentDate.getFullYear())
  const [notes, setNotes] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const selectedTenant = tenants.find(t => t.id === tenantId)

  const filteredTenants = useMemo(() => {
    const q = tenantSearch.toLowerCase()
    return tenants.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.slug || '').toLowerCase().includes(q)
    )
  }, [tenants, tenantSearch])

  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`

  const years = []
  for (let y = currentDate.getFullYear() - 2; y <= currentDate.getFullYear() + 1; y++) {
    years.push(y)
  }

  const handleSubmit = async () => {
    if (!tenantId) { toast.error('Please select a tenant'); return }
    setSubmitting(true)
    try {
      await billingAPI.generateInvoice({
        tenant_id: tenantId,
        period_start: periodStart,
        notes: notes.trim() || undefined,
      })
      toast.success(`Invoice generated${sendEmail ? ' and sent' : ''}`)
      onSuccess()
      onClose()
    } catch (e) {
      const detail = e?.response?.data?.detail || 'Invoice generation failed'
      toast.error(detail)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sparknode-purple/10 flex items-center justify-center">
              <HiOutlineDocumentText className="w-5 h-5 text-sparknode-purple" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Generate Invoice</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Tenant selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tenant</label>
            <div className="relative mb-2">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tenants…"
                value={tenantSearch}
                onChange={e => setTenantSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sparknode-purple/30"
              />
            </div>
            <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
              {filteredTenants.length === 0 ? (
                <p className="text-sm text-gray-400 py-3 text-center">No tenants found</p>
              ) : filteredTenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTenantId(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${
                    tenantId === t.id ? 'bg-sparknode-purple/5 border-l-2 border-l-sparknode-purple' : ''
                  }`}
                >
                  <div className="w-7 h-7 rounded-md bg-sparknode-purple/10 flex items-center justify-center shrink-0">
                    <HiOutlineOfficeBuilding className="w-4 h-4 text-sparknode-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{t.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{t.subscription_tier || 'free'} · {t.billing_cycle || 'monthly'}</p>
                  </div>
                  {tenantId === t.id && <HiOutlineCheckCircle className="w-4 h-4 text-sparknode-purple shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Billing period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <HiOutlineCalendar className="inline w-4 h-4 mr-1 -mt-0.5" />
              Billing Period
            </label>
            <div className="flex gap-2">
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sparknode-purple/30"
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sparknode-purple/30"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Tenant billing preview */}
          {selectedTenant && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Billing Preview</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <span className="text-gray-500">Tenant</span>
                <span className="font-medium text-gray-900 truncate">{selectedTenant.name}</span>
                <span className="text-gray-500">Period</span>
                <span className="font-medium text-gray-900">{MONTHS[month - 1]} {year}</span>
                <span className="text-gray-500">Cycle</span>
                <span className="font-medium text-gray-900 capitalize">{selectedTenant.billing_cycle || 'monthly'}</span>
                <span className="text-gray-500">Base Amount</span>
                <span className="font-medium text-gray-900">
                  {selectedTenant.billing_amount
                    ? fmtCurrency(selectedTenant.billing_amount, selectedTenant.billing_currency || 'INR')
                    : '—'}
                </span>
                {selectedTenant.billing_discount_pct > 0 && (
                  <>
                    <span className="text-gray-500">Discount</span>
                    <span className="font-medium text-green-600">{selectedTenant.billing_discount_pct}%</span>
                  </>
                )}
                <span className="text-gray-500">Invoice Total</span>
                <span className="font-bold text-sparknode-purple">
                  {selectedTenant.billing_final_amount
                    ? fmtCurrency(selectedTenant.billing_final_amount, selectedTenant.billing_currency || 'INR')
                    : selectedTenant.billing_amount
                      ? fmtCurrency(selectedTenant.billing_amount, selectedTenant.billing_currency || 'INR')
                      : '—'}
                </span>
                {selectedTenant.billing_contact_email && (
                  <>
                    <span className="text-gray-500">Send To</span>
                    <span className="font-medium text-gray-900 truncate text-xs">{selectedTenant.billing_contact_email}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add a note to this invoice…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sparknode-purple/30"
            />
          </div>

          {/* Send email toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setSendEmail(!sendEmail)}
              className={`relative w-10 h-6 rounded-full transition-colors ${sendEmail ? 'bg-sparknode-purple' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sendEmail ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm text-gray-700">Send invoice email to billing contact</span>
          </label>
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !tenantId}
            className="flex items-center gap-1.5 px-5 py-2 bg-sparknode-purple text-white text-sm font-semibold rounded-lg hover:bg-sparknode-purple/90 disabled:opacity-50 transition-colors"
          >
            <HiOutlineDocumentText className="w-4 h-4" />
            {submitting ? 'Generating…' : sendEmail ? 'Generate & Send' : 'Generate Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Billing() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [prefilledTenantId, setPrefilledTenantId] = useState(null)

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

  const voidMutation = useMutation({
    mutationFn: (invoiceId) => billingAPI.updateStatus(invoiceId, { status: 'void' }),
    onSuccess: () => { toast.success('Invoice voided'); qc.invalidateQueries({ queryKey: ['billing-invoices'] }) },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Void failed'),
  })

  const openGenerateModal = (tenantId = null) => {
    setPrefilledTenantId(tenantId)
    setShowGenerateModal(true)
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalReceived   = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
  const pendingRevenue  = invoices.filter(i => i.status === 'pending' || i.status === 'sent').reduce((s, i) => s + Number(i.total), 0)
  const overdueRevenue  = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.total), 0)

  const tenantMap = useMemo(() => Object.fromEntries(tenants.map(t => [t.id, t])), [tenants])

  return (
    <div className="space-y-6">
      {/* Generate Invoice Modal */}
      {showGenerateModal && (
        <GenerateInvoiceModal
          tenants={tenants.filter(t => t.id !== '00000000-0000-0000-0000-000000000000')}
          initialTenantId={prefilledTenantId}
          onClose={() => { setShowGenerateModal(false); setPrefilledTenantId(null) }}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['billing-invoices'] })
            qc.invalidateQueries({ queryKey: ['billing-tenants'] })
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <HiOutlineCreditCard className="w-8 h-8 text-sparknode-purple" />
            Billing & Invoices
          </h1>
          <p className="text-gray-600 mt-1">Generate invoices, track payments, and manage tenant subscriptions</p>
        </div>
        <button
          onClick={() => openGenerateModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-sparknode-purple text-white text-sm font-semibold rounded-xl hover:bg-sparknode-purple/90 transition-colors shadow-sm shadow-sparknode-purple/20"
        >
          <HiOutlinePlusCircle className="w-5 h-5" />
          Generate Invoice
        </button>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Received',  value: totalReceived,  color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200', icon: <HiOutlineCheckCircle className="w-6 h-6 text-green-600" />,       sub: `${invoices.filter(i => i.status === 'paid').length} paid` },
          { label: 'Pending',         value: pendingRevenue, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: <HiOutlineDocumentText className="w-6 h-6 text-yellow-600" />,    sub: `${invoices.filter(i => i.status === 'pending' || i.status === 'sent').length} outstanding` },
          { label: 'Overdue',         value: overdueRevenue, color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    icon: <HiOutlineExclamationCircle className="w-6 h-6 text-red-600" />, sub: `${invoices.filter(i => i.status === 'overdue').length} overdue` },
          { label: 'Active Tenants',  value: null,           color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: <HiOutlineOfficeBuilding className="w-6 h-6 text-indigo-600" />,  sub: 'paying subscribers', count: tenants.filter(t => t.subscription_status === 'active').length },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-xl border ${s.border} p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-600">{s.label}</p>
                {s.value !== null
                  ? <p className={`text-2xl font-bold mt-1 ${s.color}`}>{fmt(s.value)}</p>
                  : <p className={`text-2xl font-bold mt-1 ${s.color}`}>{loadingTenants ? '…' : s.count}</p>
                }
                <p className="text-xs text-gray-500 mt-1.5">{s.sub}</p>
              </div>
              <div className={`w-11 h-11 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
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
            <p className="text-sm text-gray-600 mt-0.5">All invoices across tenants</p>
          </div>
          <button onClick={() => refetchInvoices()} title="Refresh" className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
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
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto">
          {loadingInvoices ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center">
              <HiOutlineDocumentText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No invoices found</p>
              <p className="text-gray-400 text-sm mt-1">
                {statusFilter !== 'all' ? `No ${statusFilter} invoices.` : 'Generate your first invoice to get started.'}
              </p>
              <button
                onClick={() => openGenerateModal()}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-sparknode-purple border border-sparknode-purple rounded-lg hover:bg-sparknode-purple/5"
              >
                <HiOutlinePlusCircle className="w-4 h-4" />
                Generate Invoice
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Invoice #', 'Tenant', 'Period', 'Amount', 'Due Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map(inv => {
                  const tenant = tenantMap[inv.tenant_id]
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-mono font-semibold text-gray-900">{inv.invoice_number}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-sparknode-purple/10 flex items-center justify-center shrink-0">
                            <HiOutlineOfficeBuilding className="w-3.5 h-3.5 text-sparknode-purple" />
                          </div>
                          <span className="text-sm text-gray-800 font-medium">{tenant?.name || inv.tenant_id?.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                        {formatPeriod(inv.period_start, inv.period_end)}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {fmtCurrency(inv.total, inv.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                        {inv.due_date || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                          {inv.status === 'paid' && <HiOutlineCheckCircle className="w-3 h-3" />}
                          {inv.status === 'overdue' && <HiOutlineExclamationCircle className="w-3 h-3" />}
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {/* PDF download */}
                          <a
                            href={billingAPI.getPdfUrl(inv.id)}
                            target="_blank"
                            rel="noreferrer"
                            title="Download PDF"
                            className="flex items-center gap-1 text-xs text-sparknode-purple hover:underline font-medium"
                          >
                            <HiOutlineDownload className="w-3.5 h-3.5" />
                            PDF
                          </a>
                          {/* Send / Resend */}
                          {(inv.status === 'pending' || inv.status === 'overdue' || inv.status === 'sent') && (
                            <button
                              onClick={() => sendMutation.mutate(inv.id)}
                              disabled={sendMutation.isPending}
                              title={inv.status === 'sent' ? 'Resend invoice email' : 'Send invoice email'}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium disabled:opacity-50"
                            >
                              <HiOutlineMail className="w-3.5 h-3.5" />
                              {inv.status === 'sent' ? 'Resend' : 'Send'}
                            </button>
                          )}
                          {/* Mark paid */}
                          {inv.status !== 'paid' && inv.status !== 'void' && inv.status !== 'cancelled' && (
                            <button
                              onClick={() => markPaidMutation.mutate(inv.id)}
                              disabled={markPaidMutation.isPending}
                              title="Mark as paid"
                              className="flex items-center gap-1 text-xs text-green-600 hover:underline font-medium disabled:opacity-50"
                            >
                              <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                              Paid
                            </button>
                          )}
                          {/* Void */}
                          {inv.status !== 'paid' && inv.status !== 'void' && inv.status !== 'cancelled' && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Void invoice ${inv.invoice_number}?`)) {
                                  voidMutation.mutate(inv.id)
                                }
                              }}
                              title="Void invoice"
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 hover:underline font-medium"
                            >
                              <HiOutlineBan className="w-3.5 h-3.5" />
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Subscription Management */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tenant Subscriptions</h2>
            <p className="text-sm text-gray-600 mt-0.5">Generate invoices and view billing configuration per tenant</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loadingTenants ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading tenants…</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Tenant', 'Tier', 'Cycle', 'Base Fee', 'Discount', 'Final Fee', 'Sub. Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants
                  .filter(t => t.id !== '00000000-0000-0000-0000-000000000000')
                  .map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sparknode-purple/10 flex items-center justify-center shrink-0">
                          <HiOutlineOfficeBuilding className="w-4 h-4 text-sparknode-purple" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${TIER_COLORS[t.subscription_tier] || 'bg-gray-100 text-gray-600'}`}>
                        {t.subscription_tier || 'free'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 capitalize">{t.billing_cycle || 'monthly'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-800">
                      {t.billing_amount
                        ? fmtCurrency(t.billing_amount, t.billing_currency || 'INR')
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {t.billing_discount_pct > 0
                        ? <span className="text-green-600 font-medium">{t.billing_discount_pct}%</span>
                        : <span className="text-gray-400">0%</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">
                      {t.billing_final_amount != null
                        ? fmtCurrency(t.billing_final_amount, t.billing_currency || 'INR')
                        : t.billing_amount
                          ? fmtCurrency(t.billing_amount, t.billing_currency || 'INR')
                          : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        t.subscription_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {t.subscription_status || 'active'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => openGenerateModal(t.id)}
                        className="inline-flex items-center gap-1 text-xs text-sparknode-purple hover:underline font-medium"
                      >
                        <HiOutlinePlusCircle className="w-3.5 h-3.5" />
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
