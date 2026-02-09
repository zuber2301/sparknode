import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  HiOutlineLockClosed
} from 'react-icons/hi'
import ConfirmModal from '../components/ConfirmModal'
import AddBudgetModal from '../components/AddBudgetModal'
import { platformAPI } from '../lib/api'
import TenantCurrencySettings from '../components/TenantCurrencySettings'
import TenantSettingsTab from '../components/TenantSettingsTab'
import OrganizationInfoCard from '../components/OrganizationInfoCard'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useAuthStore } from '../store/authStore'

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
  const [actionOpenFor, setActionOpenFor] = useState(null)
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false)
  const [budgetTarget, setBudgetTarget] = useState(null)
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
    expiry_policy: 'NEVER'
  })
  
  // Feature flags state
  const [featureFlagsValue, setFeatureFlagsValue] = useState('{}')

  const { data: tiersResponse } = useQuery({
    queryKey: ['subscriptionTiers'],
    queryFn: () => platformAPI.getSubscriptionTiers(),
  })

  // Fetch all tenants by default for dashboard overview
  const { data: tenantsResponse, isLoading } = useQuery({
    queryKey: ['platformTenants', { searchQuery }],
    queryFn: () => platformAPI.getTenants({
      search: searchQuery || undefined,
    }),
    enabled: isPlatformOwner(),
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
      setShowCreateModal(false)
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



  const updateFlagsMutation = useMutation({
    mutationFn: ({ tenantId, payload }) => platformAPI.updateFeatureFlags(tenantId, payload),
    onSuccess: () => {
      toast.success('Feature flags updated')
      queryClient.invalidateQueries(['platformTenants'])
      setShowFlagsModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update feature flags')
    },
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

  const handleCreateTenant = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    createMutation.mutate({
      name: formData.get('name'),
      slug: formData.get('slug') || undefined,
      domain: formData.get('domain') || undefined,
      subscription_tier: formData.get('subscription_tier'),
      max_users: parseInt(formData.get('max_users'), 10),
      master_budget_balance: parseFloat(formData.get('master_budget_balance') || '0'),
      admin_email: formData.get('admin_email'),
      admin_first_name: formData.get('admin_first_name'),
      admin_last_name: formData.get('admin_last_name'),
      admin_password: formData.get('admin_password'),
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
        currency_label: full.currency_label || full.currency || 'INR',
        point_symbol: full.point_symbol || full.currency_symbol || '₹',
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
        feature_flags: full.feature_flags || {}
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
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl">
            <HiOutlineOfficeBuilding className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Tenants</p>
            <p className="text-xl font-bold text-gray-900">{stats.totalTenants}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-xl">
            <HiOutlineCheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active Orgs</p>
            <p className="text-xl font-bold text-gray-900">{stats.activeTenants}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-xl">
            <HiOutlinePlus className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Enterprise Tier</p>
            <p className="text-xl font-bold text-gray-900">{stats.enterpriseTenants}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-xl">
            <HiOutlineCurrencyRupee className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Balance</p>
            <p className="text-xl font-bold text-gray-900">₹{stats.totalBalance.toLocaleString()}</p>
          </div>
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
                  { key: 'branding', label: 'Settings', Icon: HiOutlineShieldCheck },
                  { key: 'security', label: 'Security', Icon: HiOutlineCheckCircle },
                  { key: 'economy', label: 'Financials', Icon: HiOutlineCurrencyRupee },
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { title: 'Total Budget Allocated', value: `₹${Number(selectedTenant?.total_allocated || 0).toLocaleString()}` , subtitle: 'Lifetime Allocations'},
                    { title: 'Total Spent', value: `₹${Number(selectedTenant?.total_spent || 0).toLocaleString()}`, subtitle: 'Redeemed / Debited'},
                    { title: 'Budget Remaining', value: `₹${Number(selectedTenant?.master_budget_balance || 0).toLocaleString()}`, subtitle: 'Current Master Balance'},
                    { title: 'Total Users', value: `${selectedTenant?.user_count || 0}`, subtitle: 'Managers / Leads / Employees'},
                  ].map((c) => (
                    <div key={c.title} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wider">{c.title}</p>
                        <div className="mt-3 flex items-center gap-3">
                          <p className="text-2xl font-extrabold text-gray-900 leading-none">{c.value}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-gray-500">{c.subtitle}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Engagement Metrics</h3>
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
                          { title: 'AVG POINTS PER EMPLOYEE', value: `₹${avgPointsPerEmployee}`, prev: null, svg: (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" stroke="#f59e0b" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          )}
                        ]

                        return cards.map((c) => {
                          const change = pct(c.value === '—' ? 0 : Number(String(c.value).replace(/[^0-9.-]+/g, '')), c.prev)
                          return (
                            <div key={c.title} className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-3 justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-md bg-white shadow-sm flex items-center justify-center">{c.svg}</div>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wider">{c.title}</p>
                                  <p className="mt-2 text-sm font-semibold text-gray-900">{c.value}</p>
                                </div>
                              </div>
                              <div>
                                {change !== null ? (
                                  <div className={`inline-flex items-center gap-1 text-sm font-semibold ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    {change > 0 ? (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    ) : change < 0 ? (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 12l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    ) : (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
                                    )}
                                    <span>{Math.abs(change)}%</span>
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-400">—</div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mt-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Burn Rate Trend</h3>
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

                    <div className="mt-3 text-sm text-gray-500 flex items-center justify-center gap-8">
                      <div><div className="text-xs text-gray-500">Credits</div><div className="font-bold text-gray-900">{chartTotalsForSelected.credits.toLocaleString()}</div></div>
                      <div><div className="text-xs text-gray-500">Debits</div><div className="font-bold text-gray-900">{chartTotalsForSelected.debits.toLocaleString()}</div></div>
                      <div><div className="text-xs text-gray-500">Net</div><div className="font-bold text-gray-900">{chartTotalsForSelected.net.toLocaleString()}</div></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'economic' && (
              <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ tenantId: selectedTenant.id, payload: { currency_label: editForm.currency_label, point_symbol: editForm.point_symbol, redemption_markup: editForm.redemption_markup } }) }} className="space-y-6 max-w-3xl">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Tenant Currency</label>
                    <select value={editForm.currency_label} onChange={(e) => setEditForm({ ...editForm, currency_label: e.target.value })} className="w-full bg-gray-50 border-none rounded-lg text-sm py-3 px-4">
                      <option>INR</option>
                      <option>USD</option>
                      <option>EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Point Symbol</label>
                    <input value={editForm.point_symbol || '₹'} onChange={(e) => setEditForm({ ...editForm, point_symbol: e.target.value })} className="w-full bg-gray-50 border-none rounded-lg text-sm py-3 px-4" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Redemption Markup (%)</label>
                  <input type="number" value={editForm.redemption_markup || 0} onChange={(e) => setEditForm({ ...editForm, redemption_markup: Number(e.target.value) })} className="w-40 bg-gray-50 border-none rounded-lg text-sm py-3 px-4" />
                  <p className="text-xs text-gray-500 mt-2">Example: 10% means a ₹500 voucher costs 550 points.</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Current Master Balance</p>
                  <p className="text-lg font-bold text-gray-900">{Number(selectedTenant.master_budget_balance || 0).toLocaleString()}</p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setSelectedTenant(null)} className="px-6 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-gray-700">Discard</button>
                  <button type="submit" disabled={updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-widest">{updateMutation.isPending ? 'Saving...' : 'Save Economic Config'}</button>
                </div>
              </form>

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

            {activeTab === 'branding' && (
              <div className="space-y-6 max-w-4xl">
                <TenantSettingsTab
                  tenant={selectedTenant}
                  onUpdate={(updated) => {
                    // refresh selected tenant with returned values
                    const updatedData = updated?.data || updated || {}
                    setSelectedTenant(prev => ({ ...prev, ...(updatedData || {}) }))
                    queryClient.invalidateQueries(['platformTenants'])
                    queryClient.invalidateQueries(['platformTenant', selectedTenant.id])
                  }}
                  setMessage={(msg) => {
                    // optional: show messages in page header or toast
                    if (msg?.type === 'success') {
                      // no-op for now
                    }
                  }}
                />
              </div>
            )}

            {activeTab === 'features' && (
              <div className="space-y-6 max-w-3xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="text-sm font-medium">AI Copilot (Sparky)</p>
                    </div>
                    <input type="checkbox" checked={!!editForm.feature_flags?.ai_copilot} onChange={(e) => setEditForm({ ...editForm, feature_flags: { ...editForm.feature_flags, ai_copilot: e.target.checked } })} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="text-sm font-medium">Tango Card Marketplace</p>
                    </div>
                    <input type="checkbox" checked={!!editForm.feature_flags?.tango_card} onChange={(e) => setEditForm({ ...editForm, feature_flags: { ...editForm.feature_flags, tango_card: e.target.checked } })} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="text-sm font-medium">Peer-to-Peer Recognition</p>
                    </div>
                    <input type="checkbox" checked={!!editForm.feature_flags?.peer_to_peer_recognition} onChange={(e) => setEditForm({ ...editForm, feature_flags: { ...editForm.feature_flags, peer_to_peer_recognition: e.target.checked } })} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="text-sm font-medium">Social Activity Feed</p>
                    </div>
                    <input type="checkbox" checked={!!editForm.feature_flags?.social_feed_enabled} onChange={(e) => setEditForm({ ...editForm, feature_flags: { ...editForm.feature_flags, social_feed_enabled: e.target.checked } })} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="text-sm font-medium">Manager Approval Workflow</p>
                    </div>
                    <input type="checkbox" checked={!!editForm.feature_flags?.recognition_approval_required} onChange={(e) => setEditForm({ ...editForm, feature_flags: { ...editForm.feature_flags, recognition_approval_required: e.target.checked } })} />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setSelectedTenant(null)} className="px-6 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-gray-700">Discard</button>
                  <button type="button" onClick={() => updateFlagsMutation.mutate({ tenantId: selectedTenant.id, payload: { feature_flags: editForm.feature_flags || {} } })} disabled={updateFlagsMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-widest">{updateFlagsMutation.isPending ? 'Saving...' : 'Save Feature Toggles'}</button>
                </div>
              </div>

            )}

            {/* Save Actions */}
            {activeTab !== 'danger' && activeTab !== 'overview' && (
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
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <HiOutlineSearch className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-400 text-sm"
              placeholder="Search organizations by name, domain, or slug..."
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

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Organization</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Tier</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Users</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Balance</th>
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
                        ₹{Number(tenant.master_budget_balance).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right relative">
                        <button onClick={() => setActionOpenFor(actionOpenFor === tenant.id ? null : tenant.id)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                          <HiOutlineDotsVertical className="w-5 h-5" />
                        </button>

                        {actionOpenFor === tenant.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-lg shadow-lg z-50 p-1">
                            
                            <button onClick={() => { setActionOpenFor(null); setBudgetTarget(tenant); setIsAddBudgetOpen(true) }} className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                              <HiOutlineCurrencyRupee className="w-4 h-4 text-gray-400" />
                              <span>Load Budget</span>
                            </button>

                            <button onClick={() => { setActionOpenFor(null); setConfirmProps({ title: `Suspend ${tenant.name}`, description: 'Suspend will restrict access for this tenant. This action can be reversed by an admin.', onConfirm: () => suspendMutation.mutate({ tenantId: tenant.id, reason: 'Suspended by admin' }) }); setIsConfirmOpen(true) }} className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md">
                              <HiOutlineLockClosed className="w-4 h-4 text-red-500" />
                              <span>Suspend</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(tierFilter ? tenantsByTier : tenants).length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-400 italic">
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

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-2">Provision New Tenant</h2>
            <p className="text-sm text-gray-500 mb-4">Creates tenant, initializes master budget, and provisions a SUPER_ADMIN.</p>
            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Tenant Name</label>
                  <input name="name" className="input" required />
                </div>
                <div>
                  <label className="label">Slug</label>
                  <input name="slug" className="input" placeholder="triton-energy" />
                </div>
                <div>
                  <label className="label">Domain</label>
                  <input name="domain" className="input" placeholder="triton-energy.sparknode.io" />
                </div>
                <div>
                  <label className="label">Subscription Tier</label>
                  <select name="subscription_tier" className="input" defaultValue="starter">
                    {tiers.length === 0 && (
                      <>
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                      </>
                    )}
                    {tiers.map((tier) => (
                      <option key={tier.tier} value={tier.tier}>{tier.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Max Users</label>
                  <input name="max_users" type="number" className="input" defaultValue="50" min="1" required />
                </div>
                <div>
                  <label className="label">Master Budget Balance (Points)</label>
                  <input name="master_budget_balance" type="number" className="input" defaultValue="0" min="0" step="0.01" />
                </div>
                
                {/* Currency Configuration - Mandatory */}
                <div>
                  <label className="label">Display Currency <span className="text-red-500">*</span></label>
                  <select name="display_currency" className="input" defaultValue="USD" required>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">This currency will be used across the tenant</p>
                </div>
                <div>
                  <label className="label">Exchange Rate (FX Rate)</label>
                  <input name="fx_rate" type="number" className="input" defaultValue="1.0" min="0.01" step="0.01" required />
                  <p className="text-xs text-gray-500 mt-1">1 USD = ? {typeof document !== 'undefined' && document.querySelector('select[name="display_currency"]')?.value || 'selected currency'}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Tenant Manager (SUPER_ADMIN)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">First Name</label>
                    <input name="admin_first_name" className="input" required />
                  </div>
                  <div>
                    <label className="label">Last Name</label>
                    <input name="admin_last_name" className="input" required />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input name="admin_email" type="email" className="input" required />
                  </div>
                  <div>
                    <label className="label">Password</label>
                    <input name="admin_password" type="password" className="input" minLength={8} required />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? 'Provisioning...' : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AddBudgetModal
        isOpen={isAddBudgetOpen}
        onClose={() => { setIsAddBudgetOpen(false); setBudgetTarget(null) }}
        tenantId={budgetTarget?.id}
      />

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
