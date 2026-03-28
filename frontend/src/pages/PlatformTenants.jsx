import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { 
  HiOutlinePlus, 
  HiOutlineSearch, 
  HiOutlineOfficeBuilding, 
  HiOutlineChevronLeft, 
  HiOutlineX,
  HiOutlineCheckCircle,
  HiOutlineShieldCheck,
  HiOutlineCurrencyRupee,
  HiOutlineDotsVertical,
  HiOutlineLockClosed,
  HiOutlineLockOpen,
  HiOutlineArrowNarrowLeft,
  HiOutlineDocumentText,
  HiOutlineMailOpen,
  HiOutlineEye,
  HiOutlineUsers,
  HiOutlineChevronRight
} from 'react-icons/hi'
import ConfirmModal from '../components/ConfirmModal'
import AddBudgetModal from '../components/AddBudgetModal'
import { platformAPI, billingAPI } from '../lib/api'
import TenantCurrencySettings from '../components/TenantCurrencySettings'
import TenantSettingsTab from '../components/TenantSettingsTab'
import OrganizationInfoCard from '../components/OrganizationInfoCard'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useAuthStore } from '../store/authStore'
import { formatDisplayValue, CURRENCY_SYMBOLS, SUPPORTED_CURRENCIES } from '../lib/currency'

// ── Recall Budget Modal ───────────────────────────────────────────────────────
function RecallBudgetModal({ tenant, onClose, onConfirm, isPending }) {
  const [amount, setAmount] = useState('')
  const [justification, setJustification] = useState('')

  const remaining = Number(tenant.master_budget_balance || 0)
  const currency   = tenant.display_currency || 'INR'
  const parsedAmt  = parseFloat(amount) || 0

  const amountErr = parsedAmt > remaining
    ? `Exceeds available balance (${formatDisplayValue(remaining, currency)})`
    : parsedAmt <= 0 && amount !== ''
    ? 'Amount must be greater than 0'
    : null
  const justErr = justification.length > 0 && justification.length < 10
    ? 'Justification must be at least 10 characters'
    : null
  const canSubmit = parsedAmt > 0 && parsedAmt <= remaining && justification.length >= 10 && !isPending

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    onConfirm({ amount: parsedAmt, justification })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
              <HiOutlineArrowNarrowLeft className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Recall Budget</h3>
              <p className="text-xs text-gray-400">{tenant.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Warning banner */}
          <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3">
            <p className="text-xs font-semibold text-orange-700 mb-0.5">Unallocated pool only</p>
            <p className="text-xs text-orange-600">
              Only budget that has not been distributed to departments can be recalled.
              Allocated department budgets are unaffected.
            </p>
          </div>

          {/* Current balance display */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Budget Remaining</p>
              <p className="text-lg font-black text-gray-800">{formatDisplayValue(remaining, currency)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">After Recall</p>
              <p className={`text-lg font-black ${parsedAmt > 0 && !amountErr ? 'text-orange-600' : 'text-gray-400'}`}>
                {parsedAmt > 0 && !amountErr
                  ? formatDisplayValue(remaining - parsedAmt, currency)
                  : '—'}
              </p>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Amount to Recall <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={`w-full border rounded-xl px-4 py-2.5 text-sm font-mono font-semibold focus:outline-none focus:ring-2 transition-colors ${
                amountErr ? 'border-red-300 bg-red-50 focus:ring-red-300' : 'border-gray-200 focus:ring-orange-300'
              }`}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            {amountErr && <p className="mt-1 text-xs text-red-500">{amountErr}</p>}
          </div>

          {/* Justification */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Justification <span className="text-red-500">*</span>
              <span className="ml-2 font-normal text-gray-400 normal-case">(min 10 chars)</span>
            </label>
            <textarea
              rows={3}
              className={`w-full border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 transition-colors ${
                justErr ? 'border-red-300 bg-red-50 focus:ring-red-300' : 'border-gray-200 focus:ring-orange-300'
              }`}
              placeholder="e.g. Recalling unused Q4 budget as per finance review on 21-Feb-2026…"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
            <div className="flex justify-between mt-1">
              {justErr
                ? <p className="text-xs text-red-500">{justErr}</p>
                : <span />}
              <span className={`text-xs ${justification.length < 10 ? 'text-gray-400' : 'text-green-600'}`}>
                {justification.length} / 1000
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors shadow-sm"
            >
              {isPending ? 'Recalling…' : 'Confirm Recall'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── UsersTab ─────────────────────────────────────────────────────────────────
const ROLE_COLORS = {
  platform_admin:  'bg-purple-100 text-purple-700',
  tenant_manager:  'bg-blue-100 text-blue-700',
  dept_lead:       'bg-indigo-100 text-indigo-700',
  tenant_user:     'bg-gray-100 text-gray-600',
}
const ROLE_LABELS = {
  platform_admin: 'Platform Admin',
  tenant_manager: 'Tenant Manager',
  dept_lead:      'Dept Lead',
  tenant_user:    'User',
}
const USER_STATUS_COLORS = {
  active:          'bg-green-100 text-green-700',
  ACTIVE:          'bg-green-100 text-green-700',
  deactivated:     'bg-red-100 text-red-600',
  DEACTIVATED:     'bg-red-100 text-red-600',
  pending_invite:  'bg-yellow-100 text-yellow-700',
  PENDING_INVITE:  'bg-yellow-100 text-yellow-700',
}

function UsersTab({ tenant }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['tenant-users', tenant.id, statusFilter],
    queryFn: () =>
      platformAPI.getTenantUsers(tenant.id, {
        status: statusFilter || undefined,
        limit: 200,
      }).then(r => r.data),
    staleTime: 30_000,
  })

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.corporate_email?.toLowerCase().includes(q)
    const matchRole = !roleFilter || u.org_role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">Users</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            All members of <span className="font-semibold">{tenant.name}</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">
          <HiOutlineUsers className="w-4 h-4" />
          {users.length} total
        </span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All Roles</option>
          <option value="tenant_manager">Tenant Manager</option>
          <option value="dept_lead">Dept Lead</option>
          <option value="tenant_user">User</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
          <option value="pending_invite">Pending Invite</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading users…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl">
          <HiOutlineUsers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">
            {users.length === 0 ? 'No users found for this tenant' : 'No users match your filters'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u, idx) => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                          {u.first_name?.[0]}{u.last_name?.[0]}
                        </div>
                      )}
                      <span className="text-sm font-semibold text-gray-800">
                        {u.first_name} {u.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{u.corporate_email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      ROLE_COLORS[u.org_role] || 'bg-gray-100 text-gray-500'
                    }`}>
                      {ROLE_LABELS[u.org_role] || u.org_role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      USER_STATUS_COLORS[u.status] || 'bg-gray-100 text-gray-500'
                    }`}>
                      {u.status?.toLowerCase().replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── BillingTab ────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  pending:   'bg-yellow-100 text-yellow-700',
  sent:      'bg-blue-100 text-blue-700',
  paid:      'bg-green-100 text-green-700',
  overdue:   'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  void:      'bg-gray-100 text-gray-400',
}

function BillingTab({ tenant }) {
  const queryClient = useQueryClient()
  const [generating, setGenerating] = useState(false)

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['billing-invoices', tenant.id],
    queryFn: () => billingAPI.getTenantInvoices(tenant.id).then(r => r.data),
    staleTime: 30_000,
  })

  const sendMutation = useMutation({
    mutationFn: (invoiceId) => billingAPI.sendInvoice(invoiceId),
    onSuccess: () => {
      toast.success('Invoice sent successfully')
      refetch()
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail || 'Failed to send invoice')
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: (invoiceId) => billingAPI.updateStatus(invoiceId, { status: 'paid' }),
    onSuccess: () => { toast.success('Marked as paid'); refetch() },
    onError: (err) => toast.error(err?.response?.data?.detail || 'Error'),
  })

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await billingAPI.generateInvoice({ tenant_id: tenant.id })
      toast.success('Invoice generated and sent')
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const fmt = (amount, currency) => {
    const sym = CURRENCY_SYMBOLS[currency] || currency
    return `${sym}${Number(amount).toLocaleString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">Invoices</h3>
          <p className="text-xs text-gray-500 mt-0.5">Auto-generated on the 1st of every month. Sent to the tenant manager email.</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg text-xs uppercase tracking-widest shadow-sm"
        >
          <HiOutlinePlus className="w-4 h-4" />
          {generating ? 'Generating…' : 'Generate Invoice'}
        </button>
      </div>

      {/* Billing config summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Cycle', value: (tenant.billing_cycle || 'monthly').charAt(0).toUpperCase() + (tenant.billing_cycle || 'monthly').slice(1) },
          { label: 'Base Amount', value: tenant.billing_amount ? fmt(tenant.billing_amount, tenant.billing_currency || tenant.display_currency) : '—' },
          { label: 'Discount', value: tenant.billing_discount_pct ? `${tenant.billing_discount_pct}%` : '0%' },
          { label: 'Final Amount', value: tenant.billing_final_amount ? fmt(tenant.billing_final_amount, tenant.billing_currency || tenant.display_currency) : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Invoice table */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading invoices…</div>
      ) : invoices.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl">
          <HiOutlineDocumentText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No invoices yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "Generate Invoice" to create the first one for this tenant.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Invoice #</th>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-left">Cycle</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Sent</th>
                <th className="px-4 py-3 text-left">Due</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {inv.period_start} → {inv.period_end}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 capitalize">{inv.billing_cycle}</td>
                  <td className="px-4 py-3 text-xs font-bold text-gray-800 text-right">
                    {fmt(inv.total, inv.currency)}
                    {Number(inv.discount_pct) > 0 && (
                      <span className="ml-1 text-green-600 font-normal">(-{inv.discount_pct}%)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-500'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {inv.sent_at ? new Date(inv.sent_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{inv.due_date || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Send / Resend — only for pending/sent/overdue */}
                      {['pending', 'sent', 'overdue'].includes(inv.status) && (
                        <button
                          onClick={() => sendMutation.mutate(inv.id)}
                          disabled={sendMutation.isPending}
                          title="Send invoice email"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold disabled:opacity-50"
                        >
                          <HiOutlineMailOpen className="w-3.5 h-3.5" />
                          {inv.status === 'sent' ? 'Resend' : 'Send'}
                        </button>
                      )}
                      {/* Mark Paid — only for sent/overdue */}
                      {['sent', 'overdue'].includes(inv.status) && (
                        <button
                          onClick={() => markPaidMutation.mutate(inv.id)}
                          disabled={markPaidMutation.isPending}
                          title="Mark as paid"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-semibold disabled:opacity-50"
                        >
                          <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                          Paid
                        </button>
                      )}
                      {/* View PDF */}
                      <a
                        href={billingAPI.getPdfUrl(inv.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View / download PDF"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
                      >
                        <HiOutlineEye className="w-3.5 h-3.5" />
                        PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function PlatformTenants() {
  const queryClient = useQueryClient()
  const { isPlatformOwner } = useAuthStore()
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showFlagsModal, setShowFlagsModal] = useState(false)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  
  // Selected tenant & tabs
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [activeTab, setActiveTab] = useState('identity')
  const [settingsStep, setSettingsStep] = useState('tenant')
  const [actionOpenFor, setActionOpenFor] = useState(null)
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false)
  const [budgetTarget, setBudgetTarget] = useState(null)
  const [isRecallOpen, setIsRecallOpen] = useState(false)
  const [recallTarget, setRecallTarget] = useState(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [confirmProps, setConfirmProps] = useState({})
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [tierFilter, setTierFilter] = useState('')
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    subscription_tier: 'free',
    max_users: 50,
    master_budget_balance: 0,
    currency_label: 'Points',
    conversion_rate: 1.0,
    auto_refill_threshold: 20,
    peer_to_peer_enabled: true,
    auth_method: 'OTP_ONLY',
    theme_config: {
      primary_color: '#3B82F6',
      secondary_color: '#8B5CF6',
      font_family: 'Inter'
    },
    domain_whitelist: [],
    award_tiers: {},
    expiry_policy: 'NEVER',
    billing_cycle: 'monthly',
    billing_amount: '',
    billing_discount_pct: 0,
    billing_currency: 'INR',
    billing_contact_email: '',
  })
  
  // Feature flags state
  const [featureFlagsValue, setFeatureFlagsValue] = useState('{}')

  // Billing fields for the create-tenant form (reactive)
  const BILLING_DEFAULTS = { INR: 200000, USD: 2500, EUR: 2500 }
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [billingAmount, setBillingAmount] = useState(BILLING_DEFAULTS['INR'])
  const [discountPct, setDiscountPct] = useState(0)
  const billingFinalAmount = Math.round(billingAmount * (1 - Math.min(Math.max(discountPct, 0), 100) / 100))
  const currencySymbol = (c) => CURRENCY_SYMBOLS[c] || c

  // Settings wizard
  const SETTINGS_STEPS = [
    { key: 'tenant',     label: 'Tenant Setup',    desc: 'Basic identity and access limits' },
    { key: 'financials', label: 'Financials',       desc: 'Budget and currency configuration' },
    { key: 'billing',    label: 'Billing',          desc: 'Subscription pricing and discounts' },
    { key: 'review',     label: 'Review & Save',    desc: 'Confirm and apply your changes' },
  ]

  // Provision wizard
  const PROVISION_STEPS = [
    { key: 'tenant',     label: 'Tenant Setup',      desc: 'Basic identity and access limits' },
    { key: 'financials', label: 'Financials',         desc: 'Budget and currency configuration' },
    { key: 'billing',    label: 'Billing',            desc: 'Subscription pricing and discounts' },
    { key: 'modules',    label: 'Modules',            desc: 'Optional feature modules' },
    { key: 'admin',      label: 'Admin Setup',        desc: 'Tenant Manager (SUPER_ADMIN) credentials' },
    { key: 'review',     label: 'Review & Provision', desc: 'Confirm and create the tenant' },
  ]
  const BLANK_TENANT = {
    name: '', slug: '', domain: '', subscription_tier: 'starter', max_users: 50,
    master_budget_balance: 0, base_currency: 'USD', display_currency: 'INR', fx_rate: 1,
    modules_ai: false, modules_sales: false, modules_sparknode: true,
    admin_first_name: '', admin_last_name: '', admin_email: '', admin_password: '',
  }
  const [createStep, setCreateStep] = useState('tenant')
  const [newTenant, setNewTenant] = useState(BLANK_TENANT)
  const ntSet = (field, val) => setNewTenant(prev => ({ ...prev, [field]: val }))
  const closeCreateModal = () => {
    setShowCreateModal(false)
    setCreateStep('tenant')
    setNewTenant({ ...BLANK_TENANT })
    setBillingCycle('monthly')
    setBillingAmount(BILLING_DEFAULTS['INR'])
    setDiscountPct(0)
  }
  const provisionStepIdx = PROVISION_STEPS.findIndex(s => s.key === createStep)
  const goProvisionNext = () => setCreateStep(PROVISION_STEPS[Math.min(provisionStepIdx + 1, PROVISION_STEPS.length - 1)].key)
  const goProvisionBack = () => provisionStepIdx === 0 ? closeCreateModal() : setCreateStep(PROVISION_STEPS[provisionStepIdx - 1].key)

  const { data: tiersResponse } = useQuery({
    queryKey: ['subscriptionTiers'],
    queryFn: () => platformAPI.getSubscriptionTiers(),
  })

  // Fetch all tenants by default for dashboard overview
  const { data: tenantsResponse, isLoading, isFetching } = useQuery({
    queryKey: ['platformTenants', { searchQuery }],
    queryFn: () => platformAPI.getTenants({
      search: searchQuery || undefined,
    }),
    enabled: isPlatformOwner(),
    placeholderData: keepPreviousData,
  })

  const { data: metricsResponse } = useQuery({
    queryKey: ['platformMetrics'],
    queryFn: () => platformAPI.getMetrics(),
    enabled: isPlatformOwner(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => platformAPI.createTenant(data),
    onSuccess: () => {
      toast.success('Tenant created successfully')
      queryClient.invalidateQueries(['platformTenants'])
      closeCreateModal()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create tenant')
    },
  })

  const suspendMutation = useMutation({
    mutationFn: ({ tenantId, reason }) => platformAPI.suspendTenant(tenantId, reason),
    onSuccess: () => {
      toast.success('Tenant suspended')
      queryClient.invalidateQueries(['platformTenants'])
      setSelectedTenant(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to suspend tenant')
    },
  })

  const addBudgetMutation = useMutation({
    mutationFn: ({ tenantId, payload }) => platformAPI.addMasterBudget(tenantId, payload),
    onSuccess: () => {
      toast.success('Budget added')
      queryClient.invalidateQueries(['platformTenants'])
      setIsAddBudgetOpen(false)
      setBudgetTarget(null)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to add budget')
  })

  const recallMutation = useMutation({
    mutationFn: ({ tenantId, payload }) => platformAPI.recallMasterBudget(tenantId, payload),
    onSuccess: (data) => {
      const resp = data?.data || data
      toast.success(resp?.message || 'Budget recalled successfully')
      queryClient.invalidateQueries(['platformTenants'])
      setIsRecallOpen(false)
      setRecallTarget(null)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to recall budget')
  })

  const activateMutation = useMutation({
    mutationFn: (tenantId) => platformAPI.activateTenant(tenantId),
    onSuccess: () => {
      toast.success('Tenant activated')
      queryClient.invalidateQueries(['platformTenants'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to activate tenant')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ tenantId, payload }) => platformAPI.updateTenant(tenantId, payload),
    onSuccess: () => {
      toast.success('Tenant updated')
      queryClient.invalidateQueries(['platformTenants'])
      setSelectedTenant(prev => ({ ...prev, ...editForm }))
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to update tenant')
    }
  })

  const currencyMutation = useMutation({
    mutationFn: ({ tenantId, payload }) => platformAPI.updateTenantCurrency(tenantId, payload),
    onSuccess: (data) => {
      toast.success(`Currency updated to ${data?.display_currency || editForm.display_currency}`)
      queryClient.invalidateQueries(['platformTenants'])
      setSelectedTenant(prev => ({
        ...prev,
        display_currency: editForm.display_currency,
        fx_rate: editForm.fx_rate,
        currency_label: editForm.currency_label,
      }))
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to update currency')
    }
  })



  const updateFlagsMutation = useMutation({
    mutationFn: ({ tenantId, payload }) => platformAPI.updateFeatureFlags(tenantId, payload),
    onSuccess: () => {
      toast.success('Feature flags updated')
      // Use matcher to invalidate ALL platformTenants queries regardless of filters
      queryClient.invalidateQueries({
        queryKey: ['platformTenants'],
        exact: false  // Match all queries starting with this key
      })
      // Invalidate currentTenant query so TopHeader refreshes with new flags
      queryClient.invalidateQueries(['currentTenant'])
      setShowFlagsModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update feature flags')
    },
  })

  const toggleFeatureMutation = useMutation({
    mutationFn: async ({ tenantId, key, value, additionalKeys = {} }) => {
      const resp = await platformAPI.getFeatureFlags(tenantId)
      const existing = resp.data ? resp.data.feature_flags || {} : resp.feature_flags || {}
      const updated = { ...(existing || {}), [key]: value, ...additionalKeys }
      return platformAPI.updateFeatureFlags(tenantId, { feature_flags: updated })
    },
    onSuccess: () => {
      toast.success('Feature updated')
      // Use matcher to invalidate ALL platformTenants queries regardless of filters
      queryClient.invalidateQueries({
        queryKey: ['platformTenants'],
        exact: false  // Match all queries starting with this key
      })
      // Invalidate currentTenant query so TopHeader refreshes with new flags
      queryClient.invalidateQueries(['currentTenant'])
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to update feature')
  })

  const tiers = useMemo(() => tiersResponse?.data?.tiers || [], [tiersResponse])
  
  const tenants = useMemo(() => {
    const data = Array.isArray(tenantsResponse?.data) 
      ? tenantsResponse.data 
      : Array.isArray(tenantsResponse) 
        ? tenantsResponse 
        : []
    return data
  }, [tenantsResponse])

  const stats = useMemo(() => {
    const metrics = metricsResponse?.data || metricsResponse || {}
    const totalTenants = metrics.total_tenants ?? tenants.length
    const activeTenants = metrics.active_tenants ?? tenants.filter(t => t.status === 'active').length
    const enterpriseTenants = metrics.tier_breakdown?.enterprise ?? tenants.filter(t => t.subscription_tier === 'enterprise').length
    const totalBalance = tenants.reduce((acc, t) => acc + (Number(t.master_budget_balance) || 0), 0)

    return {
      totalTenants,
      activeTenants,
      enterpriseTenants,
      totalBalance
    }
  }, [metricsResponse, tenants])

  const { data: tenantsByTierResponse, isLoading: isTierLoading } = useQuery({
    queryKey: ['platformTenantsByTier', tierFilter],
    queryFn: () => platformAPI.getTenants({ subscription_tier: tierFilter }),
    enabled: isPlatformOwner() && Boolean(tierFilter),
  })

  const tenantsByTier = useMemo(() => {
    const data = Array.isArray(tenantsByTierResponse?.data) ? tenantsByTierResponse.data : Array.isArray(tenantsByTierResponse) ? tenantsByTierResponse : []
    return data
  }, [tenantsByTierResponse])

  const submitCreateTenant = () => {
    // Ensure at least one module is selected
    if (!newTenant.modules_sparknode && !newTenant.modules_sales) {
      toast.error('At least one module (SparkNode or IgniteNode) must be enabled')
      return
    }
    const featureFlags = {}
    if (newTenant.modules_ai) { featureFlags.ai_module_enabled = true; featureFlags.ai_copilot = true }
    if (newTenant.modules_sales) { featureFlags.sales_marketing = true }
    const enabledModules = {
      sparknode: !!newTenant.modules_sparknode,
      ignitenode: !!newTenant.modules_sales,
    }
    createMutation.mutate({
      name: newTenant.name,
      slug: newTenant.slug || undefined,
      domain: newTenant.domain || undefined,
      subscription_tier: newTenant.subscription_tier,
      max_users: parseInt(newTenant.max_users, 10),
      master_budget_balance: parseFloat(newTenant.master_budget_balance || 0),
      base_currency: newTenant.base_currency,
      display_currency: newTenant.display_currency,
      fx_rate: parseFloat(newTenant.fx_rate || 1),
      admin_email: newTenant.admin_email,
      admin_first_name: newTenant.admin_first_name,
      admin_last_name: newTenant.admin_last_name,
      admin_password: newTenant.admin_password,
      feature_flags: featureFlags,
      enabled_modules: enabledModules,
      billing_cycle: billingCycle,
      billing_amount: billingAmount,
      billing_discount_pct: discountPct,
      billing_final_amount: billingFinalAmount,
    })
  }

  const handleSelectTenant = async (tenant) => {
    // Fetch full tenant details from platform API to ensure fields like email are present
    try {
      const resp = await platformAPI.getTenantById(tenant.id)
      const full = resp.data || resp
      setSelectedTenant(full)
      setActiveTab('overview')
      setEditForm({
        name: full.name || '',
        slug: full.slug || full.domain || '',
        primary_contact_email: full.primary_contact_email || full.admin_email || '',
        domain: full.domain || '',
        subscription_tier: full.subscription_tier || 'trial',
        max_users: full.max_users || 50,
        master_budget_balance: full.master_budget_balance || 0,
        base_currency: full.base_currency || 'USD',
        display_currency: full.display_currency || 'INR',
        fx_rate: full.fx_rate || 1.0,
        currency_label: full.currency_label || full.currency || 'INR',
        point_symbol: full.point_symbol || full.currency_symbol || CURRENCY_SYMBOLS.INR,
        redemption_markup: full.redemption_markup || 0,
        subscription_ends_at: full.subscription_ends_at || '',
        status: full.status || 'active',
        conversion_rate: full.conversion_rate || 1.0,
        auto_refill_threshold: full.auto_refill_threshold || 20,
        peer_to_peer_enabled: full.peer_to_peer_enabled !== false,
        auth_method: full.auth_method || 'OTP_ONLY',
        theme_config: full.theme_config || {
          primary_color: '#3B82F6',
          secondary_color: '#8B5CF6',
          font_family: 'Inter'
        },
        domain_whitelist: full.domain_whitelist || [],
        award_tiers: full.award_tiers || {},
        expiry_policy: full.expiry_policy || 'never',
        logoPreview: full.logo_url || full.logo || null,
        feature_flags: full.feature_flags || {},
        enabled_modules: full.enabled_modules || { sparknode: true, ignitenode: false },
        billing_cycle: full.billing_cycle || 'monthly',
        billing_amount: full.billing_amount != null ? Number(full.billing_amount) : '',
        billing_discount_pct: full.billing_discount_pct != null ? Number(full.billing_discount_pct) : 0,
        billing_currency: full.billing_currency || full.display_currency || 'INR',
        billing_contact_email: full.billing_contact_email || '',
      })
    } catch (err) {
      // fallback to shallow tenant object if API fetch fails
      setSelectedTenant(tenant)
      setActiveTab('overview')
      setEditForm(prev => ({ ...prev, name: tenant.name || prev.name }))
    }

    // If after selecting the tenant we still don't have a primary contact email,
    // try to load tenant users and use the corporate_email of the first manager/admin user.
    try {
      const current = (await Promise.resolve()).then(() => selectedTenant) // no-op to satisfy linter
    } catch (e) {
      // noop
    }
    // Note: use a separate flow to fetch users if email missing on the selectedTenant object
    (async () => {
      const current = (selectedTenant && selectedTenant.id) ? selectedTenant : tenant
      const missingEmail = !(current?.primary_contact_email || current?.admin_email)
      if (missingEmail) {
        try {
          const usersResp = await platformAPI.getTenantUsers(current.id)
          const users = (usersResp.data) ? usersResp.data : usersResp
          if (Array.isArray(users) && users.length > 0) {
            // Prefer roles that look like admin/manager/lead
            const preferred = users.find(u => /admin|manager|lead|hr/i.test(u.org_role)) || users[0]
            const email = preferred?.corporate_email || preferred?.personal_email || null
            if (email) {
              setSelectedTenant(prev => ({ ...prev, primary_contact_email: email }))
              setEditForm(prev => ({ ...prev, primary_contact_email: email }))
            }
          }
        } catch (err) {
          // ignore user fetch failures
        }
      }
    })()
  }

  const navigate = useNavigate()
  const location = useLocation()

  // If navigated here with a selectedTenantId (from TenantDashboard), auto-select it
  useEffect(() => {
    try {
      const selId = location?.state?.selectedTenantId
      if (selId && tenants && tenants.length > 0 && !selectedTenant) {
        const found = tenants.find(t => String(t.id) === String(selId))
        if (found) {
          handleSelectTenant(found)
          setActiveTab('overview')
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }
    } catch (err) {
      // noop
    }
  }, [location, tenants])

  const handleSuspend = (tenant) => {
    const reason = window.prompt(`Suspend ${tenant.name}. Provide a reason:`)
    if (!reason) return
    suspendMutation.mutate({ tenantId: tenant.id, reason })
  }

  const handleSaveChanges = () => {
    if (!selectedTenant) return
    const payload = {
      subscription_tier: editForm.subscription_tier,
      max_users: editForm.max_users,
      master_budget_balance: editForm.master_budget_balance,
      currency: editForm.currency || editForm.currency_label,
      markup_percent: editForm.redemption_markup || editForm.markup_percent || 0,
      enabled_rewards: editForm.enabled_rewards || [],
      currency_label: editForm.currency_label,
      conversion_rate: editForm.conversion_rate,
      auto_refill_threshold: editForm.auto_refill_threshold,
      peer_to_peer_enabled: editForm.peer_to_peer_enabled,
      redemptions_paused: editForm.redemptions_paused || false,
      auth_method: editForm.auth_method,
      theme_config: editForm.theme_config,
      domain_whitelist: editForm.domain_whitelist,
      award_tiers: editForm.award_tiers,
      expiry_policy: editForm.expiry_policy,
      branding_config: editForm.branding_config || {}
    }
    updateMutation.mutate({ tenantId: selectedTenant.id, payload })
  }

  const handleSaveSettings = () => {
    if (!selectedTenant) return
    const payload = {
      name: editForm.name,
      domain: editForm.domain,
      slug: editForm.slug,
      primary_contact_email: editForm.primary_contact_email,
      subscription_tier: editForm.subscription_tier,
      max_users: parseInt(editForm.max_users, 10),
      base_currency: editForm.base_currency,
      display_currency: editForm.display_currency,
      fx_rate: parseFloat(editForm.fx_rate) || 1,
      billing_cycle: editForm.billing_cycle,
      billing_amount: editForm.billing_amount !== '' ? parseFloat(editForm.billing_amount) : null,
      billing_discount_pct: parseFloat(editForm.billing_discount_pct) || 0,
      billing_currency: editForm.billing_currency,
      billing_contact_email: editForm.billing_contact_email || null,
    }
    updateMutation.mutate({ tenantId: selectedTenant.id, payload })
  }

  const handleSaveFlags = (e) => {
    e.preventDefault()
    try {
      const parsed = JSON.parse(featureFlagsValue || '{}')
      updateFlagsMutation.mutate({ tenantId: selectedTenant.id, payload: { feature_flags: parsed } })
    } catch (error) {
      toast.error('Feature flags must be valid JSON')
    }
  }

  // Budget activity for selected tenant (overview chart)
  const { data: budgetActivityRespForSelected, isLoading: budgetLoadingForSelected } = useQuery({
    queryKey: ['budgetActivity', selectedTenant?.id, 'monthly', 6],
    queryFn: () => selectedTenant ? platformAPI.getBudgetActivity(selectedTenant.id, { period: 'monthly', intervals: 6 }).then(r => r.data) : Promise.resolve(null),
    enabled: !!selectedTenant,
  })

  const chartDataForSelected = (budgetActivityRespForSelected && budgetActivityRespForSelected.data) ? budgetActivityRespForSelected.data.map(d => ({ period: d.period, credits: Number(d.credits), debits: Number(d.debits), net: Number(d.net) })) : []

  const chartTotalsForSelected = useMemo(() => {
    const credits = chartDataForSelected.reduce((s, d) => s + (d.credits || 0), 0)
    const debits = chartDataForSelected.reduce((s, d) => s + (d.debits || 0), 0)
    const net = credits - debits
    return { credits, debits, net }
  }, [chartDataForSelected])



  if (!isPlatformOwner()) {
    return (
      <div className="card text-center py-12">
        <HiOutlineOfficeBuilding className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500">Only Sparknode Admins can manage tenants.</p>
      </div>
    )
  }

  return (
    <div className="w-full px-2 lg:px-4 py-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Dashboard</h1>
          <p className="text-sm text-gray-500">Global oversight of all platform organizations</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-all shadow-sm"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Provision New Tenant
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <HiOutlineOfficeBuilding className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Total Tenants</p>
          </div>
          <p className="text-3xl font-extrabold text-blue-700 leading-none">{stats.totalTenants}</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <HiOutlineCheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active Orgs</p>
          </div>
          <p className="text-3xl font-extrabold text-emerald-700 leading-none">{stats.activeTenants}</p>
        </div>

        <div className="bg-purple-50 border border-purple-100 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <HiOutlineShieldCheck className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Enterprise Tier</p>
          </div>
          <p className="text-3xl font-extrabold text-purple-700 leading-none">{stats.enterpriseTenants}</p>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <HiOutlineCurrencyRupee className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Total Balance</p>
          </div>
          <p className="text-2xl font-extrabold text-indigo-700 leading-none">{formatDisplayValue(stats.totalBalance, 'INR')}</p>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading || isTierLoading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : selectedTenant ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gray-50/50 border-b border-gray-100 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  onClick={() => setSelectedTenant(null)}
                  className="text-sm text-indigo-600 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedTenant(null) }}
                >
                  <span className="text-sm font-semibold text-indigo-600">Tenant/</span><span className="text-sm font-semibold text-indigo-600 ml-1">{selectedTenant.name}</span>
                </div>
              </div>
              <div />
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-4">
                {[
                  { key: 'overview', label: 'Overview', Icon: HiOutlineOfficeBuilding },
                  { key: 'features', label: 'Features', Icon: HiOutlineDotsVertical },
                  { key: 'branding', label: 'Settings', Icon: HiOutlineShieldCheck },
                  { key: 'security', label: 'Security', Icon: HiOutlineCheckCircle },
                  { key: 'economic', label: 'Budget Management', Icon: HiOutlineCurrencyRupee },
                  { key: 'users', label: 'Users', Icon: HiOutlineUsers },
                  { key: 'billing', label: 'Billing', Icon: HiOutlineDocumentText },
                  { key: 'danger', label: 'Danger Zone', Icon: HiOutlineLockClosed }
                ].map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold transition-all ${
                      activeTab === key
                        ? 'text-indigo-600 border-b-2 border-indigo-500'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${activeTab === key ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className="leading-none">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-8">
            {activeTab === 'identity' && (
              <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ tenantId: selectedTenant.id, payload: { name: editForm.name, slug: editForm.slug, primary_contact_email: editForm.primary_contact_email, domain: editForm.domain } }) }} className="space-y-6 max-w-3xl">
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Organization Name</label>
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-gray-50 border-none rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 py-3 px-4" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Tenant Slug</label>
                    <input value={editForm.slug} readOnly className="w-full bg-gray-100 border-none rounded-lg text-sm py-3 px-4 font-mono" />
                    <p className="text-xs text-gray-500 mt-1">Read-only after creation.</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Primary Contact Email</label>
                    <input value={editForm.primary_contact_email} onChange={(e) => setEditForm({ ...editForm, primary_contact_email: e.target.value })} className="w-full bg-gray-50 border-none rounded-lg text-sm py-3 px-4" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Company Domain</label>
                  <input value={editForm.domain} onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })} className="w-full bg-gray-50 border-none rounded-lg text-sm py-3 px-4" placeholder="example.com" />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setSelectedTenant(null)} className="px-6 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-gray-700">Discard</button>
                  <button type="submit" disabled={updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-widest">{updateMutation.isPending ? 'Saving...' : 'Save Identity'}</button>
                </div>
              </form>

            )}

            {activeTab === 'overview' && (
              <div className="space-y-6 max-w-4xl">
                <OrganizationInfoCard tenant={selectedTenant} />

                {/* ── Tenant Financials ──────────────────────────────────── */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Financial Position</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { title: 'Budget Remaining', value: formatDisplayValue(Number(selectedTenant?.master_budget_balance || 0), selectedTenant?.display_currency || 'INR'), sub: 'Available to distribute', bg: 'bg-indigo-50', border: 'border-indigo-100', label: 'text-indigo-400', val: 'text-indigo-700' },
                      { title: 'Total Allocated', value: formatDisplayValue(Number(selectedTenant?.total_allocated || 0), selectedTenant?.display_currency || 'INR'), sub: 'Lifetime allocations', bg: 'bg-gray-50', border: 'border-gray-200', label: 'text-gray-400', val: 'text-gray-800' },
                      { title: 'Total Spent', value: formatDisplayValue(Number(selectedTenant?.total_spent || 0), selectedTenant?.display_currency || 'INR'), sub: 'Redeemed / debited', bg: 'bg-orange-50', border: 'border-orange-100', label: 'text-orange-400', val: 'text-orange-700' },
                      { title: 'Total Users', value: `${selectedTenant?.user_count || 0}`, sub: 'Managers · Employees', bg: 'bg-blue-50', border: 'border-blue-100', label: 'text-blue-400', val: 'text-blue-700' },
                    ].map((c) => (
                      <div key={c.title} className={`${c.bg} border ${c.border} p-5 rounded-2xl shadow-sm`}>
                        <p className={`text-[10px] font-bold ${c.label} uppercase tracking-widest`}>{c.title}</p>
                        <p className={`text-xl font-extrabold ${c.val} mt-2 leading-none`}>{c.value}</p>
                        <p className={`text-xs ${c.label} mt-1.5`}>{c.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Budget quick actions shortcut */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('economic')}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-3 px-5 rounded-xl shadow-sm shadow-indigo-200 transition-all"
                  >
                    <HiOutlineCurrencyRupee className="w-4 h-4" />
                    Manage Budget
                  </button>
                  <span className="text-sm text-gray-400">Load or recall budget, configure currency &amp; markup</span>
                </div>

                {/* ── Engagement Metrics ───────────────────────────────── */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Engagement Metrics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {(() => {
                        const recognitionsThisMonth = selectedTenant?.recent_recognitions_count ?? selectedTenant?.total_recognitions ?? 0
                        const redemptionsThisMonth = selectedTenant?.recent_redemptions_count ?? selectedTenant?.total_redemptions ?? 0
                        const activeUsersThisWeek = selectedTenant?.active_user_count ?? 0
                        const avgPointsPerEmployee = selectedTenant && selectedTenant.user_count ? Math.round((Number(selectedTenant.total_points_distributed || 0) || 0) / selectedTenant.user_count) : 0

                        // try to find previous-period fields, otherwise null
                        const recognitionsPrev = selectedTenant?.recent_recognitions_previous ?? selectedTenant?.recent_recognitions_prev ?? selectedTenant?.recent_recognitions_last_period ?? null
                        const redemptionsPrev = selectedTenant?.recent_redemptions_previous ?? selectedTenant?.recent_redemptions_prev ?? selectedTenant?.recent_redemptions_last_period ?? null
                        const activeUsersPrev = selectedTenant?.active_user_count_previous ?? selectedTenant?.active_user_count_prev ?? null

                        const pct = (latest, prev) => {
                          if (prev === null || prev === undefined || prev === 0) return null
                          const change = ((latest - prev) / Math.abs(prev)) * 100
                          return Math.round(change)
                        }

                        const cards = [
                          { title: 'RECOGNITIONS THIS MONTH', value: recognitionsThisMonth || '—', prev: recognitionsPrev, svg: (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v4" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 7l2 2" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 7l-2 2" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 14l-2 2" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 14l2 2" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          )},
                          { title: 'REDEMPTIONS THIS MONTH', value: redemptionsThisMonth || '—', prev: redemptionsPrev, svg: (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 10V6a4 4 0 0 1 8 0v4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          )},
                          { title: 'ACTIVE USERS THIS WEEK', value: activeUsersThisWeek || '—', prev: activeUsersPrev, svg: (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 11c1.657 0 3-1.567 3-3.5S17.657 4 16 4s-3 1.567-3 3.5S14.343 11 16 11zM8 11c1.657 0 3-1.567 3-3.5S9.657 4 8 4 5 5.567 5 7.5 6.343 11 8 11z" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 20c0-2.5 3-4 6-4s6 1.5 6 4" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 20c0-2.5 3-4 6-4s6 1.5 6 4" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          )},
                          { title: 'AVG POINTS PER EMPLOYEE', value: formatDisplayValue(avgPointsPerEmployee || 0, selectedTenant?.display_currency || 'INR'), prev: null, svg: (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" stroke="#f59e0b" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          )}
                        ]

                        return cards.map((c) => {
                          const change = pct(c.value === '—' ? 0 : Number(String(c.value).replace(/[^0-9.-]+/g, '')), c.prev)
                          return (
                            <div key={c.title} className="bg-gray-50 border border-gray-100 p-5 rounded-2xl shadow-sm flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0">{c.svg}</div>
                                {change !== null ? (
                                  <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
                                    change > 0 ? 'bg-emerald-50 text-emerald-600' : change < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {change > 0 ? '↑' : change < 0 ? '↓' : '·'} {Math.abs(change)}%
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-300">—</div>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.title}</p>
                                <p className="text-xl font-extrabold text-gray-800 mt-1 leading-none">{c.value}</p>
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                </div>

                {/* ── Burn Rate Trend ──────────────────────────────────── */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Burn Rate Trend</h3>
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                    <div>
                    {chartDataForSelected && chartDataForSelected.length > 0 ? (
                      <div style={{ width: '100%', height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartDataForSelected} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="credits" stroke="#10b981" fill="#10b98133" name="Credits" />
                            <Area type="monotone" dataKey="debits" stroke="#f97316" fill="#f9731633" name="Debits" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-48 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                        <span>No budget activity yet</span>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-center gap-8">
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Credits</div>
                        <div className="text-base font-extrabold text-gray-800 mt-0.5">{formatDisplayValue(chartTotalsForSelected.credits, selectedTenant?.display_currency || 'INR')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Debits</div>
                        <div className="text-base font-extrabold text-gray-800 mt-0.5">{formatDisplayValue(chartTotalsForSelected.debits, selectedTenant?.display_currency || 'INR')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Net</div>
                        <div className="text-base font-extrabold text-gray-800 mt-0.5">{formatDisplayValue(chartTotalsForSelected.net, selectedTenant?.display_currency || 'INR')}</div>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'economic' && (
              <div className="space-y-8 max-w-3xl">

                {/* ── Budget Summary ──────────────────────────────────────── */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Current Budget Position</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Master Balance</p>
                      <p className="text-xl font-extrabold text-indigo-700 mt-2 leading-none">{formatDisplayValue(Number(selectedTenant.master_budget_balance || 0), selectedTenant?.display_currency || 'INR')}</p>
                      <p className="text-xs text-indigo-400 mt-1">Available to distribute</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Allocated</p>
                      <p className="text-xl font-extrabold text-gray-800 mt-2 leading-none">{formatDisplayValue(Number(selectedTenant.total_allocated || 0), selectedTenant?.display_currency || 'INR')}</p>
                      <p className="text-xs text-gray-400 mt-1">Lifetime allocations</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Total Spent</p>
                      <p className="text-xl font-extrabold text-orange-700 mt-2 leading-none">{formatDisplayValue(Number(selectedTenant.total_spent || 0), selectedTenant?.display_currency || 'INR')}</p>
                      <p className="text-xs text-orange-400 mt-1">Redeemed / debited</p>
                    </div>
                  </div>
                </div>

                {/* ── Budget Actions ──────────────────────────────────────── */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Budget Actions</h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setBudgetTarget(selectedTenant); setIsAddBudgetOpen(true) }}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-sm shadow-sm shadow-indigo-200 transition-all"
                    >
                      <HiOutlineCurrencyRupee className="w-4 h-4" />
                      Load Budget
                    </button>
                    <button
                      onClick={() => { setRecallTarget(selectedTenant); setIsRecallOpen(true) }}
                      disabled={Number(selectedTenant.master_budget_balance || 0) <= 0}
                      className="flex items-center gap-2 border border-orange-300 text-orange-600 hover:bg-orange-50 font-bold py-3 px-6 rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <HiOutlineArrowNarrowLeft className="w-4 h-4" />
                      Recall Budget
                    </button>
                  </div>
                  {Number(selectedTenant.master_budget_balance || 0) <= 0 && (
                    <p className="text-xs text-gray-400 mt-2">Recall is disabled — no unallocated balance available.</p>
                  )}
                </div>

                {/* ── Economic Configuration ──────────────────────────────── */}
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Economic Configuration</h3>
                  <form onSubmit={(e) => { e.preventDefault(); currencyMutation.mutate({ tenantId: selectedTenant.id, payload: { display_currency: editForm.display_currency, fx_rate: editForm.fx_rate, currency_label: editForm.currency_label } }) }} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Base Currency (Billing)</label>
                        <select value={editForm.base_currency} onChange={(e) => setEditForm({ ...editForm, base_currency: e.target.value })} className="w-full bg-gray-50 border-none rounded-lg text-sm py-3 px-4">
                          {['USD', 'EUR', 'INR', 'GBP', 'JPY', 'AED', 'SGD', 'AUD', 'CAD'].map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Display Currency</label>
                        <select value={editForm.display_currency} onChange={(e) => setEditForm({ ...editForm, display_currency: e.target.value })} className="w-full bg-gray-50 border-none rounded-lg text-sm py-3 px-4">
                          {['USD', 'EUR', 'INR', 'GBP', 'JPY', 'AED', 'SGD', 'AUD', 'CAD'].map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">FX Rate (Base → Display)</label>
                        <input type="number" step="any" value={editForm.fx_rate} onChange={(e) => setEditForm({ ...editForm, fx_rate: Number(e.target.value) })} className="w-full bg-gray-50 border-none rounded-lg text-sm py-3 px-4" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Point Symbol</label>
                        <input value={editForm.point_symbol || CURRENCY_SYMBOLS.INR} onChange={(e) => setEditForm({ ...editForm, point_symbol: e.target.value })} className="w-full bg-gray-50 border-none rounded-lg text-sm py-3 px-4" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Currency Label (e.g. Points)</label>
                      <input value={editForm.currency_label} onChange={(e) => setEditForm({ ...editForm, currency_label: e.target.value })} className="w-full bg-gray-50 border-none rounded-lg text-sm py-3 px-4" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Redemption Markup (%)</label>
                      <input type="number" value={editForm.redemption_markup || 0} onChange={(e) => setEditForm({ ...editForm, redemption_markup: Number(e.target.value) })} className="w-40 bg-gray-50 border-none rounded-lg text-sm py-3 px-4" />
                      <p className="text-xs text-gray-500 mt-2">Example: 10% means a {formatDisplayValue(500, editForm.display_currency || 'INR')} voucher costs 550 points.</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button type="submit" disabled={currencyMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-widest">{currencyMutation.isPending ? 'Saving...' : 'Save Currency Config'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'tier' && (
              <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ tenantId: selectedTenant.id, payload: { subscription_tier: editForm.subscription_tier, max_users: editForm.max_users, subscription_ends_at: editForm.subscription_ends_at, status: editForm.status } }) }} className="space-y-6 max-w-3xl">
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Subscription Tier</label>
                  <select value={editForm.subscription_tier} onChange={(e) => setEditForm({ ...editForm, subscription_tier: e.target.value })} className="w-full bg-gray-50 border-none rounded-lg text-sm py-3 px-4">
                    <option value="trial">Trial</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">User Seat Limit</label>
                    <input type="number" value={editForm.max_users} onChange={(e) => setEditForm({ ...editForm, max_users: Number(e.target.value) })} className="w-full bg-gray-50 border-none rounded-lg text-sm py-3 px-4" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Subscription End Date</label>
                    <input type="date" value={editForm.subscription_ends_at || ''} onChange={(e) => setEditForm({ ...editForm, subscription_ends_at: e.target.value })} className="w-full bg-gray-50 border-none rounded-lg text-sm py-3 px-4" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Account Status</label>
                  <select value={editForm.status || selectedTenant.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-40 bg-gray-50 border-none rounded-lg text-sm py-3 px-4">
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setSelectedTenant(null)} className="px-6 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-gray-700">Discard</button>
                  <button type="submit" disabled={updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-widest">{updateMutation.isPending ? 'Saving...' : 'Save Subscription'}</button>
                </div>
              </form>

            )}

            {activeTab === 'branding' && (() => {
              const sym = (c) => CURRENCY_SYMBOLS[c] || c
              const billingFinalAmt = Math.round(
                (parseFloat(editForm.billing_amount) || 0) *
                (1 - Math.min(Math.max(parseFloat(editForm.billing_discount_pct) || 0, 0), 100) / 100)
              )
              const settingsStepIdx = SETTINGS_STEPS.findIndex(s => s.key === settingsStep)
              return (
                <div className="-m-8 flex" style={{ minHeight: 580 }}>

                  {/* ── Left Sidebar ── */}
                  <div className="w-56 flex-shrink-0 border-r border-gray-100 bg-gray-50/50 flex flex-col">
                    <div className="px-5 py-5 border-b border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Settings</p>
                      <p className="text-base font-bold text-gray-800 mt-0.5 truncate">{selectedTenant?.name}</p>
                    </div>
                    <nav className="flex-1 py-3 px-3 space-y-0.5">
                      {SETTINGS_STEPS.map((s, i) => {
                        const active = settingsStep === s.key
                        const done = settingsStepIdx > i
                        return (
                          <button
                            key={s.key}
                            onClick={() => setSettingsStep(s.key)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
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
                    <div className="px-4 py-4 border-t border-gray-100">
                      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
                          style={{ width: `${((settingsStepIdx + 1) / SETTINGS_STEPS.length) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">{settingsStepIdx + 1} of {SETTINGS_STEPS.length}</p>
                    </div>
                  </div>

                  {/* ── Right Content ── */}
                  <div className="flex-1 flex flex-col min-w-0">

                    {/* Gradient header */}
                    <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-6 py-4 flex-shrink-0">
                      <h3 className="text-base font-semibold text-white">{SETTINGS_STEPS[settingsStepIdx]?.label}</h3>
                      <p className="text-xs text-indigo-200 mt-0.5">{SETTINGS_STEPS[settingsStepIdx]?.desc}</p>
                    </div>

                    {/* Step body */}
                    <div className="flex-1 overflow-y-auto p-6">

                      {/* ── Step 1: Tenant Setup ── */}
                      {settingsStep === 'tenant' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="label">Organization Name <span className="text-red-500">*</span></label>
                              <input className="input" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                            </div>
                            <div>
                              <label className="label">Slug</label>
                              <input className="input font-mono" value={editForm.slug || ''} readOnly />
                              <p className="text-xs text-gray-400 mt-1">Read-only after creation.</p>
                            </div>
                            <div>
                              <label className="label">Company Domain</label>
                              <input className="input" value={editForm.domain || ''} onChange={e => setEditForm({ ...editForm, domain: e.target.value })} placeholder="example.com" />
                            </div>
                            <div>
                              <label className="label">Subscription Tier</label>
                              <select className="input" value={editForm.subscription_tier || 'starter'} onChange={e => setEditForm({ ...editForm, subscription_tier: e.target.value })}>
                                {tiers.length === 0 ? (
                                  <>
                                    <option value="free">Free</option>
                                    <option value="starter">Starter</option>
                                    <option value="professional">Professional</option>
                                    <option value="enterprise">Enterprise</option>
                                  </>
                                ) : tiers.map(t => (
                                  <option key={t.tier} value={t.tier}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label">Max Users <span className="text-red-500">*</span></label>
                              <input className="input" type="number" min="1" value={editForm.max_users || 50} onChange={e => setEditForm({ ...editForm, max_users: Number(e.target.value) })} />
                            </div>
                            <div>
                              <label className="label">Account Status</label>
                              <select className="input" value={editForm.status || selectedTenant?.status || 'active'} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="maintenance">Maintenance</option>
                              </select>
                            </div>
                            <div>
                              <label className="label">Primary Contact Email</label>
                              <input className="input" type="email" value={editForm.primary_contact_email || ''} onChange={e => setEditForm({ ...editForm, primary_contact_email: e.target.value })} />
                            </div>
                            <div>
                              <label className="label">Subscription End Date</label>
                              <input className="input" type="date" value={editForm.subscription_ends_at ? editForm.subscription_ends_at.toString().slice(0, 10) : ''} onChange={e => setEditForm({ ...editForm, subscription_ends_at: e.target.value })} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Step 2: Financials ── */}
                      {settingsStep === 'financials' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="label">Base Currency (Billing) <span className="text-red-500">*</span></label>
                              <select className="input" value={editForm.base_currency || 'USD'} onChange={e => setEditForm({ ...editForm, base_currency: e.target.value })}>
                                {Object.keys(SUPPORTED_CURRENCIES).map(c => <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>)}
                              </select>
                              <p className="text-xs text-gray-400 mt-1">Currency the tenant is invoiced in</p>
                            </div>
                            <div>
                              <label className="label">Display Currency <span className="text-red-500">*</span></label>
                              <select className="input" value={editForm.display_currency || 'INR'} onChange={e => setEditForm({ ...editForm, display_currency: e.target.value, billing_currency: e.target.value })}>
                                {Object.keys(SUPPORTED_CURRENCIES).map(c => <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>)}
                              </select>
                              <p className="text-xs text-gray-400 mt-1">Currency shown in the tenant dashboard</p>
                            </div>
                            <div>
                              <label className="label">FX Rate (Base → Display)</label>
                              <input className="input" type="number" min="0.0001" step="any" value={editForm.fx_rate || 1} onChange={e => setEditForm({ ...editForm, fx_rate: parseFloat(e.target.value) || 1 })} />
                              <p className="text-xs text-gray-400 mt-1">Leave as 1 if both currencies match. For USD → INR, enter ~83.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Step 3: Billing ── */}
                      {settingsStep === 'billing' && (
                        <div className="space-y-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="label">Billing Cycle</label>
                              <select className="input" value={editForm.billing_cycle || 'monthly'} onChange={e => setEditForm({ ...editForm, billing_cycle: e.target.value })}>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="annually">Annually</option>
                              </select>
                            </div>
                            <div>
                              <label className="label">
                                Amount / month
                                <span className="ml-1 font-normal text-gray-400 text-xs normal-case">
                                  ({sym(editForm.billing_currency || editForm.display_currency || 'INR')})
                                </span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 select-none">
                                  {sym(editForm.billing_currency || editForm.display_currency || 'INR')}
                                </span>
                                <input type="number" className="input pl-8" min="0" step="1"
                                  value={editForm.billing_amount}
                                  onChange={e => setEditForm({ ...editForm, billing_amount: e.target.value })} />
                              </div>
                            </div>
                            <div>
                              <label className="label">Discount <span className="font-normal text-gray-400">(%)</span></label>
                              <div className="relative">
                                <input type="number" className="input pr-8" min="0" max="100" step="0.5"
                                  value={editForm.billing_discount_pct}
                                  onChange={e => setEditForm({ ...editForm, billing_discount_pct: Math.min(100, Math.max(0, Number(e.target.value))) })} />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 select-none">%</span>
                              </div>
                            </div>
                            <div>
                              <label className="label">Billing Contact Email</label>
                              <input className="input" type="email" value={editForm.billing_contact_email || ''} onChange={e => setEditForm({ ...editForm, billing_contact_email: e.target.value })} placeholder="billing@company.com" />
                            </div>
                          </div>
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-5 py-4 flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                              {parseFloat(editForm.billing_discount_pct) > 0 ? (
                                <>
                                  <span className="line-through text-gray-400 mr-2">
                                    {sym(editForm.billing_currency || 'INR')}{Number(editForm.billing_amount).toLocaleString()}
                                  </span>
                                  <span className="text-green-600 font-semibold">{editForm.billing_discount_pct}% off</span>
                                </>
                              ) : (
                                <span className="text-gray-400">No discount applied</span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Final / month</span>
                              <div className="text-2xl font-extrabold text-indigo-700 leading-tight">
                                {sym(editForm.billing_currency || 'INR')}{billingFinalAmt.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Step 4: Review & Save ── */}
                      {settingsStep === 'review' && (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-500">Review your changes before saving. Click a section in the left nav to make edits.</p>
                          <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                            {[
                              { section: 'Tenant Setup', rows: [
                                ['Organization Name', editForm.name || '—'],
                                ['Domain', editForm.domain || '—'],
                                ['Subscription Tier', editForm.subscription_tier || '—'],
                                ['Max Users', editForm.max_users],
                                ['Status', editForm.status || selectedTenant?.status || '—'],
                              ]},
                              { section: 'Financials', rows: [
                                ['Base Currency', editForm.base_currency || '—'],
                                ['Display Currency', editForm.display_currency || '—'],
                                ['FX Rate', editForm.fx_rate || 1],
                              ]},
                              { section: 'Billing', rows: [
                                ['Billing Cycle', editForm.billing_cycle || 'monthly'],
                                ['Amount / month', editForm.billing_amount ? `${sym(editForm.billing_currency || 'INR')}${Number(editForm.billing_amount).toLocaleString()}` : '—'],
                                ['Discount', editForm.billing_discount_pct ? `${editForm.billing_discount_pct}%` : 'None'],
                                ['Contact Email', editForm.billing_contact_email || '—'],
                              ]},
                            ].map(({ section, rows }) => (
                              <div key={section}>
                                <div className="px-4 py-2 bg-gray-50">
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{section}</p>
                                </div>
                                <div className="divide-y divide-gray-50">
                                  {rows.map(([label, value]) => (
                                    <div key={label} className="px-4 py-2.5 flex items-center justify-between text-sm">
                                      <span className="text-gray-500">{label}</span>
                                      <span className="font-medium text-gray-800 text-right max-w-[60%] truncate">{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Footer navigation */}
                    <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
                      <button
                        onClick={() => {
                          if (settingsStepIdx === 0) setActiveTab('overview')
                          else setSettingsStep(SETTINGS_STEPS[settingsStepIdx - 1].key)
                        }}
                        className="px-5 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-gray-700"
                      >
                        {settingsStepIdx === 0 ? 'Cancel' : '← Back'}
                      </button>
                      {settingsStepIdx < SETTINGS_STEPS.length - 1 ? (
                        <button
                          onClick={() => setSettingsStep(SETTINGS_STEPS[settingsStepIdx + 1].key)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-widest flex items-center gap-2"
                        >
                          Next <HiOutlineChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={handleSaveSettings}
                          disabled={updateMutation.isPending}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all"
                        >
                          {updateMutation.isPending ? 'Saving…' : 'Save Settings'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {activeTab === 'features' && (
              <div className="space-y-6 max-w-3xl">

                {/* ── Module Access ──────────────────────────────────────── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">📦</span>
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Module Access</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-200 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-800">SparkNode</p>
                        <p className="text-xs text-gray-500">Employee Engagement Platform (EEP)</p>
                      </div>
                      <input type="checkbox" checked={!!editForm.enabled_modules?.sparknode} onChange={(e) => setEditForm({ ...editForm, enabled_modules: { ...editForm.enabled_modules, sparknode: e.target.checked } })} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-800">IgniteNode</p>
                        <p className="text-xs text-orange-500 font-medium">(Sales &amp; Marketing)</p>
                      </div>
                      <input type="checkbox" checked={!!editForm.enabled_modules?.ignitenode} onChange={(e) => setEditForm({ ...editForm, enabled_modules: { ...editForm.enabled_modules, ignitenode: e.target.checked } })} />
                    </div>
                  </div>
                  {!editForm.enabled_modules?.sparknode && !editForm.enabled_modules?.ignitenode && (
                    <p className="text-xs text-red-500 mt-2">⚠ At least one module must be enabled</p>
                  )}
                </div>

                {/* ── SparkNode EEP ──────────────────────────────────────── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">🎯</span>
                    <p className="text-xs font-bold text-violet-600 uppercase tracking-widest">SparkNode — Employee Engagement Platform (EEP)</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-100 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-800">AI Copilot (Sparky)</p>
                        <p className="text-xs text-gray-400">ai_copilot</p>
                      </div>
                      <input type="checkbox" checked={!!editForm.feature_flags?.ai_copilot} onChange={(e) => setEditForm({ ...editForm, feature_flags: { ...editForm.feature_flags, ai_copilot: e.target.checked, ai_module_enabled: e.target.checked } })} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-100 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-800">Tango Card Marketplace</p>
                        <p className="text-xs text-gray-400">tango_card</p>
                      </div>
                      <input type="checkbox" checked={!!editForm.feature_flags?.tango_card} onChange={(e) => setEditForm({ ...editForm, feature_flags: { ...editForm.feature_flags, tango_card: e.target.checked } })} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-100 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-800">Peer-to-Peer Recognition</p>
                        <p className="text-xs text-gray-400">peer_to_peer_recognition</p>
                      </div>
                      <input type="checkbox" checked={!!editForm.feature_flags?.peer_to_peer_recognition} onChange={(e) => setEditForm({ ...editForm, feature_flags: { ...editForm.feature_flags, peer_to_peer_recognition: e.target.checked } })} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-100 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-800">Social Activity Feed</p>
                        <p className="text-xs text-gray-400">social_feed_enabled</p>
                      </div>
                      <input type="checkbox" checked={!!editForm.feature_flags?.social_feed_enabled} onChange={(e) => setEditForm({ ...editForm, feature_flags: { ...editForm.feature_flags, social_feed_enabled: e.target.checked } })} />
                    </div>
                  <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-100 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Manager Approval Workflow</p>
                      <p className="text-xs text-gray-400">recognition_approval_required</p>
                    </div>
                    <input type="checkbox" checked={!!editForm.feature_flags?.recognition_approval_required} onChange={(e) => setEditForm({ ...editForm, feature_flags: { ...editForm.feature_flags, recognition_approval_required: e.target.checked } })} />
                  </div>
                  </div>
                </div>

                {/* ── IgniteNode ──────────────────────────────────────── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">🔥</span>
                    <div>
                      <p className="text-xs font-bold text-orange-500 uppercase tracking-widest">IgniteNode</p>
                      <p className="text-xs font-semibold text-orange-400">(Sales &amp; Marketing)</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-800">IgniteNode</p>
                        <p className="text-xs font-medium text-orange-500">(Sales &amp; Marketing)</p>
                        <p className="text-xs text-gray-500">Sales Events · Campaigns · Growth Events</p>
                        <p className="text-xs text-gray-400">sales_marketing</p>
                      </div>
                      <input type="checkbox" checked={!!editForm.feature_flags?.sales_marketing || !!editForm.feature_flags?.sales_marketting_enabled} onChange={(e) => setEditForm({ ...editForm, feature_flags: { ...editForm.feature_flags, sales_marketing: e.target.checked } })} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setSelectedTenant(null)} className="px-6 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-gray-700">Discard</button>
                  <button type="button" onClick={() => updateFlagsMutation.mutate({ tenantId: selectedTenant.id, payload: { feature_flags: editForm.feature_flags || {}, enabled_modules: editForm.enabled_modules } })} disabled={updateFlagsMutation.isPending || (!editForm.enabled_modules?.sparknode && !editForm.enabled_modules?.ignitenode)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-widest disabled:opacity-50">{updateFlagsMutation.isPending ? 'Saving...' : 'Save Feature Toggles'}</button>
                </div>
              </div>

            )}

            {/* ── Users Tab ────────────────────────────────────────────── */}
            {activeTab === 'users' && (
              <UsersTab tenant={selectedTenant} />
            )}

            {/* ── Billing Tab ──────────────────────────────────────────── */}
            {activeTab === 'billing' && (
              <BillingTab tenant={selectedTenant} />
            )}

            {/* Save Actions */}
            {activeTab !== 'danger' && activeTab !== 'overview' && activeTab !== 'economic' && activeTab !== 'billing' && activeTab !== 'users' && activeTab !== 'features' && activeTab !== 'branding' && (
              <div className="mt-12 pt-8 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedTenant(null)}
                  className="px-6 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-gray-700 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={updateMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all"
                >
                  {updateMutation.isPending ? 'Propagating...' : 'Commit Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white px-5 py-3 rounded-full border-2 border-violet-500 flex items-center gap-3">
            {isFetching && !isLoading ? (
              <svg className="w-5 h-5 text-violet-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <HiOutlineSearch className="w-5 h-5 text-gray-400 shrink-0" />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-gray-900 placeholder-gray-400 text-sm"
              placeholder="Search tenants by name or slug..."
              autoComplete="off"
            />
            <div className="h-6 w-px bg-gray-200 mx-2" />
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="bg-transparent border-none rounded-lg text-[10px] font-bold text-gray-500 focus:ring-0 px-3 uppercase tracking-widest cursor-pointer"
            >
              <option value="">All Tiers</option>
              {tiers.map((tier) => (
                <option key={tier.tier} value={tier.tier}>{tier.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Organization</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Tier</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Users</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Budget Allocated</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Budget Remaining</th>
                      <th className="px-6 py-5 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {(tierFilter ? tenantsByTier : tenants).map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                            {tenant.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              <button onClick={() => handleSelectTenant(tenant)} className="text-indigo-600 hover:underline font-semibold text-left p-0">
                                {tenant.name}
                              </button>
                            </div>
                            <div className="text-xs text-gray-400">{tenant.domain || tenant.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          tenant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {tenant.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-600 uppercase italic text-[11px] font-bold">{tenant.subscription_tier}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium font-mono">
                        {tenant.user_count || 0} / {tenant.max_users}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {formatDisplayValue(Number(tenant.budget_allocated || 0), tenant.display_currency || 'INR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-700">
                        {formatDisplayValue(Number(tenant.master_budget_balance || 0), tenant.display_currency || 'INR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right relative">
                        <button onClick={() => setActionOpenFor(actionOpenFor === tenant.id ? null : tenant.id)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                          <HiOutlineDotsVertical className="w-5 h-5" />
                        </button>

                        {actionOpenFor === tenant.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-lg shadow-lg z-50 p-1">
                            
                          <button onClick={async () => {
                              setActionOpenFor(null)
                              try {
                                const currentFlagsResp = await platformAPI.getFeatureFlags(tenant.id)
                                const current = currentFlagsResp.data ? currentFlagsResp.data.feature_flags || {} : currentFlagsResp.feature_flags || {}
                                const newVal = !Boolean(current.sales_marketing || current.sales_marketting_enabled)
                                toggleFeatureMutation.mutate({ tenantId: tenant.id, key: 'sales_marketing', value: newVal })
                              } catch (e) { toast.error('Failed to toggle Sales Events') }
                            }} className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                              <HiOutlineOfficeBuilding className="w-4 h-4 text-gray-400" />
                              <span>{(tenant.feature_flags?.sales_marketing || tenant.feature_flags?.sales_marketting_enabled) ? 'Disable' : 'Enable'} IgniteNode</span>
                            </button>

                            <button onClick={async () => {
                              setActionOpenFor(null)
                              try {
                                const currentFlagsResp = await platformAPI.getFeatureFlags(tenant.id)
                                const current = currentFlagsResp.data ? currentFlagsResp.data.feature_flags || {} : currentFlagsResp.feature_flags || {}
                                const newVal = !Boolean(current.ai_copilot || current.ai_module_enabled)
                                toggleFeatureMutation.mutate({ tenantId: tenant.id, key: 'ai_copilot', value: newVal, additionalKeys: { ai_module_enabled: newVal } })
                              } catch (e) {
                                toast.error('Failed to toggle SNPilot')
                              }
                            }} className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                              <HiOutlineShieldCheck className="w-4 h-4 text-gray-400" />
                              <span>{(tenant.feature_flags?.ai_copilot || tenant.feature_flags?.ai_module_enabled) ? 'Disable' : 'Enable'} SNPilot (AI Copilot)</span>
                            </button>

                            {tenant.status === 'suspended' ? (
                              <button onClick={() => { setActionOpenFor(null); setConfirmProps({ title: `Reactivate ${tenant.name}`, description: 'Reactivate will restore access for this tenant.', onConfirm: () => activateMutation.mutate(tenant.id) }); setIsConfirmOpen(true) }} className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-md">
                                <HiOutlineLockOpen className="w-4 h-4 text-green-500" />
                                <span>Reactivate</span>
                              </button>
                            ) : (
                              <button onClick={() => { setActionOpenFor(null); setConfirmProps({ title: `Suspend ${tenant.name}`, description: 'Suspend will restrict access for this tenant. This action can be reversed by an admin.', onConfirm: () => suspendMutation.mutate({ tenantId: tenant.id, reason: 'Suspended by admin' }) }); setIsConfirmOpen(true) }} className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md">
                                <HiOutlineLockClosed className="w-4 h-4 text-red-500" />
                                <span>Suspend</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(tierFilter ? tenantsByTier : tenants).length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-gray-400 italic">
                        No organizations found matching criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Tenant Modal — Left-nav wizard */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex shadow-2xl overflow-hidden">

            {/* ── Left Nav ── */}
            <div className="w-52 bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
              <div className="px-5 pt-5 pb-3">
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Provision</p>
                <h2 className="text-sm font-bold text-gray-900 leading-tight mt-0.5">New Tenant</h2>
              </div>
              <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
                {PROVISION_STEPS.map((s, i) => {
                  const active = createStep === s.key
                  const done = i < provisionStepIdx
                  return (
                    <button
                      key={s.key}
                      onClick={() => setCreateStep(s.key)}
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
                    style={{ width: `${((provisionStepIdx + 1) / PROVISION_STEPS.length) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">{provisionStepIdx + 1} of {PROVISION_STEPS.length}</p>
              </div>
            </div>

            {/* ── Right Content ── */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Step header */}
              <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-base font-semibold text-white">{PROVISION_STEPS[provisionStepIdx]?.label}</h3>
                  <p className="text-xs text-indigo-200 mt-0.5">{PROVISION_STEPS[provisionStepIdx]?.desc}</p>
                </div>
                <button onClick={closeCreateModal} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>

              {/* Step body */}
              <div className="flex-1 overflow-y-auto p-6">

                {/* ── Tenant Setup ── */}
                {createStep === 'tenant' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Tenant Name <span className="text-red-500">*</span></label>
                        <input className="input" value={newTenant.name} onChange={e => ntSet('name', e.target.value)} placeholder="Triton Energy" autoFocus />
                      </div>
                      <div>
                        <label className="label">Slug</label>
                        <input className="input" value={newTenant.slug} onChange={e => ntSet('slug', e.target.value)} placeholder="triton-energy" />
                        <p className="text-xs text-gray-400 mt-1">Auto-generated from name if left blank</p>
                      </div>
                      <div>
                        <label className="label">Domain</label>
                        <input className="input" value={newTenant.domain} onChange={e => ntSet('domain', e.target.value)} placeholder="triton-energy.sparknode.io" />
                      </div>
                      <div>
                        <label className="label">Subscription Tier</label>
                        <select className="input" value={newTenant.subscription_tier} onChange={e => ntSet('subscription_tier', e.target.value)}>
                          {tiers.length === 0 ? (
                            <>
                              <option value="free">Free</option>
                              <option value="starter">Starter</option>
                              <option value="professional">Professional</option>
                              <option value="enterprise">Enterprise</option>
                            </>
                          ) : tiers.map(t => (
                            <option key={t.tier} value={t.tier}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Max Users <span className="text-red-500">*</span></label>
                        <input className="input" type="number" min="1" value={newTenant.max_users} onChange={e => ntSet('max_users', Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Financials ── */}
                {createStep === 'financials' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="label">Master Budget Balance (Points)</label>
                        <input className="input" type="number" min="0" step="1"
                          value={newTenant.master_budget_balance}
                          onChange={e => ntSet('master_budget_balance', Number(e.target.value))} />
                        <p className="text-xs text-gray-400 mt-1">Initial pts pool allocated to this tenant. Can be topped up later.</p>
                      </div>
                      <div>
                        <label className="label">Base Currency (Billing) <span className="text-red-500">*</span></label>
                        <select className="input" value={newTenant.base_currency} onChange={e => ntSet('base_currency', e.target.value)}>
                          {Object.keys(SUPPORTED_CURRENCIES).map(c => <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>)}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">Currency the tenant will be invoiced in</p>
                      </div>
                      <div>
                        <label className="label">Display Currency <span className="text-red-500">*</span></label>
                        <select className="input" value={newTenant.display_currency} onChange={e => {
                          const cur = e.target.value
                          ntSet('display_currency', cur)
                          setBillingAmount(BILLING_DEFAULTS[cur] ?? 2500)
                          setDiscountPct(0)
                        }}>
                          {Object.keys(SUPPORTED_CURRENCIES).map(c => <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>)}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">Currency shown in the tenant dashboard</p>
                      </div>
                      <div>
                        <label className="label">FX Rate (Base → Display)</label>
                        <input className="input" type="number" min="0.0001" step="any"
                          value={newTenant.fx_rate}
                          onChange={e => ntSet('fx_rate', parseFloat(e.target.value) || 1)} />
                        <p className="text-xs text-gray-400 mt-1">Leave as 1 if both currencies match. For USD → INR, enter ~83.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Billing ── */}
                {createStep === 'billing' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Billing Cycle</label>
                        <select className="input" value={billingCycle} onChange={e => setBillingCycle(e.target.value)}>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="annually">Annually</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">
                          Amount / month&nbsp;
                          <span className="font-normal text-gray-400 text-xs normal-case">
                            (default: {currencySymbol(newTenant.display_currency)}{BILLING_DEFAULTS[newTenant.display_currency]?.toLocaleString()})
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 select-none">
                            {currencySymbol(newTenant.display_currency)}
                          </span>
                          <input type="number" className="input pl-8" min="0" step="1"
                            value={billingAmount} onChange={e => setBillingAmount(Number(e.target.value))} />
                        </div>
                      </div>
                      <div>
                        <label className="label">Discount <span className="font-normal text-gray-400">(%)</span></label>
                        <div className="relative">
                          <input type="number" className="input pr-8" min="0" max="100" step="0.5"
                            value={discountPct}
                            onChange={e => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value))))} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 select-none">%</span>
                        </div>
                      </div>
                    </div>

                    {/* Final amount summary card */}
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-5 py-4 flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        {discountPct > 0 ? (
                          <>
                            <span className="line-through text-gray-400 mr-2">
                              {currencySymbol(newTenant.display_currency)}{Number(billingAmount).toLocaleString()}
                            </span>
                            <span className="text-green-600 font-semibold">{discountPct}% off</span>
                          </>
                        ) : (
                          <span className="text-gray-400">No discount applied</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Final / month</span>
                        <div className="text-2xl font-extrabold text-indigo-700 leading-tight">
                          {currencySymbol(newTenant.display_currency)}{billingFinalAmount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Modules ── */}
                {createStep === 'modules' && (
                  <div className="space-y-6">
                    <p className="text-sm text-gray-500">Select which product modules to enable for this tenant. At least one module is required.</p>

                    {/* Validation warning */}
                    {!newTenant.modules_sparknode && !newTenant.modules_sales && (
                      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                        <p className="text-xs font-semibold text-red-700">At least one module (SparkNode or IgniteNode) must be enabled.</p>
                      </div>
                    )}

                    {/* SparkNode EEP */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span>🎯</span>
                        <p className="text-xs font-bold text-violet-600 uppercase tracking-widest">SparkNode — Employee Engagement Platform (EEP)</p>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">Recognition, rewards, events, gifting & team engagement.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label key="modules_sparknode" className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          newTenant.modules_sparknode ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white hover:border-violet-200 hover:bg-violet-50/30'
                        }`}>
                          <input type="checkbox" checked={newTenant.modules_sparknode}
                            onChange={e => ntSet('modules_sparknode', e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer" />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">SparkNode EEP</p>
                            <p className="text-xs text-gray-500 mt-0.5">Employee Engagement Platform</p>
                          </div>
                        </label>
                        <label key="modules_ai" className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          newTenant.modules_ai ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white hover:border-violet-200 hover:bg-violet-50/30'
                        }`}>
                          <input type="checkbox" checked={newTenant.modules_ai}
                            onChange={e => ntSet('modules_ai', e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer" />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">AI Module</p>
                            <p className="text-xs text-gray-500 mt-0.5">Sparky AI Copilot &amp; predictive analytics</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* IgniteNode */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span>🔥</span>
                        <div>
                          <p className="text-xs font-bold text-orange-500 uppercase tracking-widest">IgniteNode</p>
                          <p className="text-xs font-semibold text-orange-400">(Sales &amp; Marketing)</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">Sales Events, Campaigns &amp; Growth Events.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label key="modules_sales" className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          newTenant.modules_sales ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/30'
                        }`}>
                          <input type="checkbox" checked={newTenant.modules_sales}
                            onChange={e => ntSet('modules_sales', e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400 cursor-pointer" />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">IgniteNode</p>
                            <p className="text-xs font-medium text-orange-500 mt-0.5">(Sales &amp; Marketing)</p>
                            <p className="text-xs text-gray-400 mt-0.5">Sales Events, Campaigns &amp; Growth Events</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Admin Setup ── */}
                {createStep === 'admin' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                      This user will be provisioned as the Tenant Manager&nbsp;
                      <span className="font-semibold text-gray-700">(SUPER_ADMIN)</span> for this organization.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">First Name <span className="text-red-500">*</span></label>
                        <input className="input" value={newTenant.admin_first_name} onChange={e => ntSet('admin_first_name', e.target.value)} autoFocus />
                      </div>
                      <div>
                        <label className="label">Last Name <span className="text-red-500">*</span></label>
                        <input className="input" value={newTenant.admin_last_name} onChange={e => ntSet('admin_last_name', e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Email <span className="text-red-500">*</span></label>
                        <input className="input" type="email" value={newTenant.admin_email} onChange={e => ntSet('admin_email', e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Password <span className="text-red-500">*</span></label>
                        <input className="input" type="password" minLength={8} value={newTenant.admin_password} onChange={e => ntSet('admin_password', e.target.value)} />
                        <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Review & Provision ── */}
                {createStep === 'review' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">Review all settings before creating the tenant. Click a step in the left nav to make changes.</p>
                    <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                      {[
                        { section: 'Tenant Setup', rows: [
                          ['Tenant Name', newTenant.name || '—'],
                          ['Slug', newTenant.slug || '(auto-generated)'],
                          ['Domain', newTenant.domain || '—'],
                          ['Subscription Tier', newTenant.subscription_tier],
                          ['Max Users', newTenant.max_users],
                        ]},
                        { section: 'Financials', rows: [
                          ['Master Budget', `${Number(newTenant.master_budget_balance).toLocaleString()} pts`],
                          ['Base Currency', newTenant.base_currency],
                          ['Display Currency', newTenant.display_currency],
                          ['FX Rate', newTenant.fx_rate],
                        ]},
                        { section: 'Billing', rows: [
                          ['Billing Cycle', billingCycle.charAt(0).toUpperCase() + billingCycle.slice(1)],
                          ['Amount / Month', `${currencySymbol(newTenant.display_currency)}${Number(billingAmount).toLocaleString()}`],
                          ['Discount', discountPct > 0 ? `${discountPct}%` : 'None'],
                          ['Final / Month', `${currencySymbol(newTenant.display_currency)}${billingFinalAmount.toLocaleString()}`],
                        ]},
                        { section: 'Modules', rows: [
                          ['SparkNode EEP', newTenant.modules_sparknode ? '✓ Enabled' : 'Disabled'],
                          ['AI Copilot (Sparky)', newTenant.modules_ai ? '✓ Enabled' : 'Disabled'],
                          ['IgniteNode (Sales & Marketing)', newTenant.modules_sales ? '✓ Enabled' : 'Disabled'],
                        ]},
                        { section: 'Admin Setup', rows: [
                          ['Name', `${newTenant.admin_first_name} ${newTenant.admin_last_name}`.trim() || '—'],
                          ['Email', newTenant.admin_email || '—'],
                        ]},
                      ].map(({ section, rows }) => (
                        <div key={section}>
                          <div className="px-4 py-2 bg-gray-50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{section}</p>
                          </div>
                          {rows.map(([label, val]) => (
                            <div key={label} className="px-4 py-2.5 flex items-center justify-between border-t border-gray-100 first:border-0">
                              <span className="text-sm text-gray-500">{label}</span>
                              <span className={`text-sm font-semibold ${String(val).includes('✓') ? 'text-green-600' : 'text-gray-900'}`}>{val}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer nav */}
              <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 bg-white">
                <button type="button" onClick={goProvisionBack} className="btn-secondary">
                  {provisionStepIdx === 0 ? 'Cancel' : '← Back'}
                </button>
                {provisionStepIdx === PROVISION_STEPS.length - 1 ? (
                  <button type="button" onClick={submitCreateTenant} disabled={createMutation.isPending} className="btn-primary">
                    {createMutation.isPending ? 'Provisioning...' : 'Create Tenant'}
                  </button>
                ) : (
                  <button type="button" onClick={goProvisionNext} className="btn-primary">
                    Next →
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      <AddBudgetModal
        isOpen={isAddBudgetOpen}
        onClose={() => { setIsAddBudgetOpen(false); setBudgetTarget(null) }}
        tenantId={budgetTarget?.id}
        tenant={budgetTarget}
      />

      {/* Recall Budget Modal */}
      {isRecallOpen && recallTarget && (
        <RecallBudgetModal
          tenant={recallTarget}
          onClose={() => { setIsRecallOpen(false); setRecallTarget(null) }}
          onConfirm={(payload) => recallMutation.mutate({ tenantId: recallTarget.id, payload })}
          isPending={recallMutation.isPending}
        />
      )}

      <ConfirmModal
        open={isConfirmOpen}
        title={confirmProps.title}
        description={confirmProps.description}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          if (typeof confirmProps.onConfirm === 'function') confirmProps.onConfirm()
          setIsConfirmOpen(false)
        }}
      />

      {/* Feature Flags Modal */}
      {showFlagsModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <h2 className="text-xl font-semibold mb-2">Feature Flags</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedTenant.name}</p>
            <form onSubmit={handleSaveFlags} className="space-y-4">
              <textarea
                className="input min-h-[220px] font-mono text-xs"
                value={featureFlagsValue}
                onChange={(e) => setFeatureFlagsValue(e.target.value)}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowFlagsModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateFlagsMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {updateFlagsMutation.isPending ? 'Saving...' : 'Save Flags'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
