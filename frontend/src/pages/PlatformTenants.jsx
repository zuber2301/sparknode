import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { HiOutlinePlus, HiOutlineSearch, HiOutlineOfficeBuilding, HiOutlineEye, HiOutlineChevronLeft, HiOutlineX } from 'react-icons/hi'
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
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
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

  const { data: tenantsResponse, isLoading } = useQuery({
    queryKey: ['platformTenants', { searchQuery, statusFilter, tierFilter }],
    queryFn: () => platformAPI.getTenants({
      search: searchQuery || undefined,
      status: statusFilter || undefined,
      subscription_tier: tierFilter || undefined,
    }),
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
    // The API returns the array directly, axios wraps it in response.data
    const data = Array.isArray(tenantsResponse?.data) 
      ? tenantsResponse.data 
      : Array.isArray(tenantsResponse) 
        ? tenantsResponse 
        : []
    return data
  }, [tenantsResponse])

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Manager</h1>
          <p className="text-sm text-gray-500">Manage tenant properties, settings, and configurations.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <HiOutlinePlus className="w-5 h-5" />
          New Tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-12"
            placeholder="Search tenants by name or domain..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input lg:w-56"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="input lg:w-56"
        >
          <option value="">All Tiers</option>
          {tiers.map((tier) => (
            <option key={tier.tier} value={tier.tier}>{tier.name}</option>
          ))}
        </select>
      </div>

      {/* Master-Detail Layout */}
      {isLoading ? (
        <div className="card">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex gap-6 min-h-[600px]">
          {/* Left: Tenant List (Compacted) */}
          <div className="w-full lg:w-96 card overflow-hidden flex flex-col">
            <div className="font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">
              Tenants ({tenants.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleSelectTenant(tenant)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedTenant?.id === tenant.id ? 'bg-sparknode-purple/5 border-l-4 border-l-sparknode-purple' : ''
                  }`}
                >
                  <p className="font-medium text-gray-900 text-sm">{tenant.name}</p>
                  <p className="text-xs text-gray-500">{tenant.domain || tenant.slug || '-'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                      tenant.status === 'active' ? 'bg-green-100 text-green-700' : 
                      tenant.status === 'suspended' ? 'bg-red-100 text-red-700' : 
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {tenant.status}
                    </span>
                    <span className="text-xs text-gray-500">{tenant.user_count ?? 0} users</span>
                  </div>
                </button>
              ))}
              {tenants.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No tenants found
                </div>
              )}
            </div>
          </div>

          {/* Right: Tenant Detail Panel */}
          {selectedTenant ? (
            <div className="flex-1 card flex flex-col">
              {/* Detail Header with Back Button */}
              <div className="border-b border-gray-200 px-6 py-4 flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <button
                    onClick={() => setSelectedTenant(null)}
                    className="mt-1 p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                    title="Back to tenant list"
                  >
                    <HiOutlineChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedTenant.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{selectedTenant.domain || selectedTenant.slug || 'No domain'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTenant(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  title="Close detail panel"
                >
                  <HiOutlineX className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-gray-200 px-6 overflow-x-auto">
                {['overview', 'branding', 'security', 'economy', 'danger'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                      activeTab === tab
                        ? 'border-sparknode-purple text-sparknode-purple'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab === 'overview' && 'Overview'}
                    {tab === 'branding' && 'Identity & Branding'}
                    {tab === 'security' && 'Access & Security'}
                    {tab === 'economy' && 'Fiscal & Rules'}
                    {tab === 'danger' && 'Danger Zone'}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Status</p>
                        <p className="text-lg font-bold text-gray-900 capitalize">{selectedTenant.status}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Subscription Tier</p>
                        <p className="text-lg font-bold text-gray-900 capitalize">{selectedTenant.subscription_tier}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Active Users</p>
                        <p className="text-lg font-bold text-gray-900">{selectedTenant.user_count ?? 0}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Master Budget</p>
                        <p className="text-lg font-bold text-gray-900">${Number(selectedTenant.master_budget_balance || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Identity & Branding Tab */}
                {activeTab === 'branding' && (
                  <div className="space-y-4">
                    <div>
                      <label className="label">Logo URL</label>
                      <input type="url" className="input" placeholder="https://..." />
                    </div>
                    <div>
                      <label className="label">Favicon URL</label>
                      <input type="url" className="input" placeholder="https://..." />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="label">Primary Color</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={editForm.theme_config.primary_color}
                            onChange={(e) => setEditForm({
                              ...editForm,
                              theme_config: { ...editForm.theme_config, primary_color: e.target.value }
                            })}
                            className="w-12 h-10 rounded border border-gray-200"
                          />
                          <input
                            type="text"
                            value={editForm.theme_config.primary_color}
                            className="input flex-1"
                            readOnly
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label">Secondary Color</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={editForm.theme_config.secondary_color}
                            onChange={(e) => setEditForm({
                              ...editForm,
                              theme_config: { ...editForm.theme_config, secondary_color: e.target.value }
                            })}
                            className="w-12 h-10 rounded border border-gray-200"
                          />
                          <input
                            type="text"
                            value={editForm.theme_config.secondary_color}
                            className="input flex-1"
                            readOnly
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label">Font Family</label>
                        <select
                          value={editForm.theme_config.font_family}
                          onChange={(e) => setEditForm({
                            ...editForm,
                            theme_config: { ...editForm.theme_config, font_family: e.target.value }
                          })}
                          className="input"
                        >
                          <option>Inter</option>
                          <option>Helvetica</option>
                          <option>Georgia</option>
                          <option>Monospace</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Access & Security Tab */}
                {activeTab === 'security' && (
                  <div className="space-y-4">
                    <div>
                      <label className="label">Authentication Method</label>
                      <select
                        value={editForm.auth_method}
                        onChange={(e) => setEditForm({ ...editForm, auth_method: e.target.value })}
                        className="input"
                      >
                        <option value="PASSWORD_AND_OTP">Password + OTP</option>
                        <option value="OTP_ONLY">OTP Only</option>
                        <option value="SSO_SAML">SSO/SAML</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Domain Whitelist (comma-separated)</label>
                      <textarea
                        value={editForm.domain_whitelist.join('\n')}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          domain_whitelist: e.target.value.split('\n').filter(d => d.trim())
                        })}
                        className="input min-h-[100px]"
                        placeholder="@company.com&#10;@company-intl.io"
                      />
                    </div>
                  </div>
                )}

                {/* Fiscal & Rules Tab */}
                {activeTab === 'economy' && (
                  <div className="space-y-4">
                    {/* Tenant Currency Settings (Platform Admin only) */}
                    {isPlatformOwner() && selectedTenant && (
                      <div className="mb-4">
                        <TenantCurrencySettings tenantId={selectedTenant.id} />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Currency Label</label>
                        <input
                          type="text"
                          value={editForm.currency_label}
                          onChange={(e) => setEditForm({ ...editForm, currency_label: e.target.value })}
                          className="input"
                          placeholder="Points"
                        />
                      </div>
                      <div>
                        <label className="label">Conversion Rate ($/unit)</label>
                        <input
                          type="number"
                          value={editForm.conversion_rate}
                          onChange={(e) => setEditForm({ ...editForm, conversion_rate: Number(e.target.value) })}
                          className="input"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="label">Auto-Refill Threshold (%)</label>
                        <input
                          type="number"
                          value={editForm.auto_refill_threshold}
                          onChange={(e) => setEditForm({ ...editForm, auto_refill_threshold: Number(e.target.value) })}
                          className="input"
                          step="1"
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className="label">Expiry Policy</label>
                        <select
                          value={editForm.expiry_policy}
                          onChange={(e) => setEditForm({ ...editForm, expiry_policy: e.target.value })}
                          className="input"
                        >
                          <option value="NEVER">Never</option>
                          <option value="90_DAYS">90 Days</option>
                          <option value="1_YEAR">1 Year</option>
                          <option value="CUSTOM">Custom</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="label flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editForm.peer_to_peer_enabled}
                          onChange={(e) => setEditForm({ ...editForm, peer_to_peer_enabled: e.target.checked })}
                          className="rounded"
                        />
                        <span>Allow Peer-to-Peer Recognition</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Danger Zone Tab */}
                {activeTab === 'danger' && (
                  <div className="space-y-4 border-t border-red-200 pt-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h3 className="font-semibold text-red-900 mb-2">Suspend Tenant</h3>
                      <p className="text-sm text-red-800 mb-4">Temporarily lock this tenant. Users cannot access the platform.</p>
                      <button
                        onClick={() => handleSuspend(selectedTenant)}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        {selectedTenant.status === 'suspended' ? 'Reactivate' : 'Suspend'} Tenant
                      </button>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h3 className="font-semibold text-red-900 mb-2">Manage Feature Flags</h3>
                      <button
                        onClick={() => {
                          setFeatureFlagsValue(JSON.stringify(selectedTenant.feature_flags || {}, null, 2))
                          setShowFlagsModal(true)
                        }}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Edit Feature Flags
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              {activeTab !== 'danger' && (
                <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
                  <button
                    onClick={handleSaveChanges}
                    disabled={updateMutation.isPending}
                    className="btn-primary"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 card flex items-center justify-center text-center">
              <div>
                <HiOutlineEye className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Select a tenant to view details</p>
              </div>
            </div>
          )}
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
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Tenant Admin (SUPER_ADMIN)</h3>
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
