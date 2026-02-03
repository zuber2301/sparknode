import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  HiOutlinePencil,
  HiOutlineLockClosed
} from 'react-icons/hi'
import ConfirmModal from '../components/ConfirmModal'
import AddBudgetModal from '../components/AddBudgetModal'
import { platformAPI } from '../lib/api'
import TenantCurrencySettings from '../components/TenantCurrencySettings'
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
  const [activeTab, setActiveTab] = useState('overview')
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
    auth_method: 'PASSWORD_AND_OTP',
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

  const handleSelectTenant = (tenant) => {
    setSelectedTenant(tenant)
    setActiveTab('overview')
    setEditForm({
      subscription_tier: tenant.subscription_tier || 'free',
      max_users: tenant.max_users || 50,
      master_budget_balance: tenant.master_budget_balance || 0,
      currency_label: tenant.currency_label || 'Points',
      conversion_rate: tenant.conversion_rate || 1.0,
      auto_refill_threshold: tenant.auto_refill_threshold || 20,
      peer_to_peer_enabled: tenant.peer_to_peer_enabled !== false,
      auth_method: tenant.auth_method || 'PASSWORD_AND_OTP',
      theme_config: tenant.theme_config || {
        primary_color: '#3B82F6',
        secondary_color: '#8B5CF6',
        font_family: 'Inter'
      },
      domain_whitelist: tenant.domain_whitelist || [],
      award_tiers: tenant.award_tiers || {},
      expiry_policy: tenant.expiry_policy || 'NEVER'
    })
  }

  const navigate = useNavigate()

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
      currency_label: editForm.currency_label,
      conversion_rate: editForm.conversion_rate,
      auto_refill_threshold: editForm.auto_refill_threshold,
      peer_to_peer_enabled: editForm.peer_to_peer_enabled,
      auth_method: editForm.auth_method,
      theme_config: editForm.theme_config,
      domain_whitelist: editForm.domain_whitelist,
      award_tiers: editForm.award_tiers,
      expiry_policy: editForm.expiry_policy
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
          <div className="bg-gray-50/50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedTenant(null)} 
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <HiOutlineChevronLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedTenant.name}</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{selectedTenant.subscription_tier} • {selectedTenant.status}</p>
              </div>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {['overview', 'branding', 'security', 'economy', 'danger'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                    activeTab === tab 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'danger' ? 'GOVERNANCE' : tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Subscription Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <p className="text-xs text-gray-500 mb-1">Authorized Users</p>
                      <p className="text-lg font-bold text-gray-900 font-mono">{selectedTenant.user_count || 0} / {selectedTenant.max_users}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <p className="text-xs text-gray-500 mb-1">Master Balance</p>
                      <p className="text-lg font-bold text-gray-900">₹{Number(selectedTenant.master_budget_balance).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Platform Identity</h3>
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-xs text-gray-500 mb-1">Domain / Access Slug</p>
                    <p className="text-sm font-bold text-gray-900 font-mono">{selectedTenant.domain || selectedTenant.slug}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'branding' && (
              <div className="space-y-6 max-w-2xl">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Primary Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editForm.theme_config.primary_color}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          theme_config: { ...editForm.theme_config, primary_color: e.target.value }
                        })}
                        className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editForm.theme_config.primary_color}
                        className="bg-gray-50 border-none rounded-lg text-sm font-mono w-full focus:ring-1 focus:ring-indigo-500"
                        readOnly
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Secondary Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editForm.theme_config.secondary_color}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          theme_config: { ...editForm.theme_config, secondary_color: e.target.value }
                        })}
                        className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editForm.theme_config.secondary_color}
                        className="bg-gray-50 border-none rounded-lg text-sm font-mono w-full focus:ring-1 focus:ring-indigo-500"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Font Family</label>
                  <select
                    value={editForm.theme_config.font_family}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      theme_config: { ...editForm.theme_config, font_family: e.target.value }
                    })}
                    className="w-full bg-gray-50 border-none rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 py-3 px-4"
                  >
                    <option>Inter</option>
                    <option>Plus Jakarta Sans</option>
                    <option>Satoshi</option>
                    <option>Monospace</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Authentication Method</label>
                  <select
                    value={editForm.auth_method}
                    onChange={(e) => setEditForm({ ...editForm, auth_method: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 py-3 px-4"
                  >
                    <option value="PASSWORD_AND_OTP">Multi-Factor (Password + OTP)</option>
                    <option value="OTP_ONLY">Passwordless (OTP Only)</option>
                    <option value="SSO_SAML">Enterprise SSO (SAML/OIDC)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Domain Whitelist</label>
                  <textarea
                    value={editForm.domain_whitelist.join('\n')}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      domain_whitelist: e.target.value.split('\n').filter(d => d.trim())
                    })}
                    className="w-full bg-gray-50 border-none rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 py-3 px-4 min-h-[120px] font-mono"
                    placeholder="e.g. @company.com (one per line)"
                  />
                </div>
              </div>
            )}

            {activeTab === 'economy' && (
              <div className="space-y-8 max-w-3xl">
                <TenantCurrencySettings tenantId={selectedTenant.id} />
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Currency Display Name</label>
                    <input
                      type="text"
                      value={editForm.currency_label}
                      onChange={(e) => setEditForm({ ...editForm, currency_label: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 py-3 px-4 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Exchange Rate (INR/Point)</label>
                    <input
                      type="number"
                      value={editForm.conversion_rate}
                      onChange={(e) => setEditForm({ ...editForm, conversion_rate: Number(e.target.value) })}
                      className="w-full bg-gray-50 border-none rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 py-3 px-4 font-mono"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <input
                    type="checkbox"
                    id="p2p"
                    checked={editForm.peer_to_peer_enabled}
                    onChange={(e) => setEditForm({ ...editForm, peer_to_peer_enabled: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="p2p" className="text-sm font-bold text-indigo-900">Enable Peer-to-Peer Recognition Economy</label>
                </div>
              </div>
            )}

            {activeTab === 'danger' && (
              <div className="space-y-6 max-w-2xl">
                <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-red-900 mb-2">Suspension Protocol</h3>
                  <p className="text-xs text-red-600 mb-6">Restricts all user access and halts financial processing for this tenant.</p>
                  <button
                    onClick={() => handleSuspend(selectedTenant)}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-widest transition-all"
                  >
                    {selectedTenant.status === 'suspended' ? 'Emergency Reactivate' : 'Initiate Suspension'}
                  </button>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-orange-900 mb-2">System overrides</h3>
                  <p className="text-xs text-orange-600 mb-6">Modify low-level feature flags and experimental configurations.</p>
                  <button
                    onClick={() => {
                      setFeatureFlagsValue(JSON.stringify(selectedTenant.feature_flags || {}, null, 2))
                      setShowFlagsModal(true)
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-widest transition-all"
                  >
                    Manage Feature Flags
                  </button>
                </div>
              </div>
            )}

            {/* Save Actions */}
            {activeTab !== 'danger' && (
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
                            <button onClick={() => { setActionOpenFor(null); handleSelectTenant(tenant); setActiveTab('overview'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                              <HiOutlinePencil className="w-4 h-4 text-gray-400" />
                              <span>Edit Settings</span>
                            </button>

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
                  <label className="label">Master Budget Balance</label>
                  <input name="master_budget_balance" type="number" className="input" defaultValue="0" min="0" step="0.01" />
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
