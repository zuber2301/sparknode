import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { HiOutlinePlus, HiOutlineSearch, HiOutlineOfficeBuilding } from 'react-icons/hi'
import { platformAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'

export default function PlatformTenants() {
  const queryClient = useQueryClient()
  const { isPlatformOwner } = useAuthStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showFlagsModal, setShowFlagsModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [featureFlagsValue, setFeatureFlagsValue] = useState('{}')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')

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

  const updateFlagsMutation = useMutation({
    mutationFn: ({ tenantId, payload }) => platformAPI.updateFeatureFlags(tenantId, payload),
    onSuccess: () => {
      toast.success('Feature flags updated')
      queryClient.invalidateQueries(['platformTenants'])
      setShowFlagsModal(false)
      setSelectedTenant(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update feature flags')
    },
  })

  const tiers = useMemo(() => tiersResponse?.data?.tiers || [], [tiersResponse])
  const tenants = useMemo(() => tenantsResponse?.data || [], [tenantsResponse])

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

  const handleSuspend = (tenant) => {
    const reason = window.prompt(`Suspend ${tenant.name}. Provide a reason:`)
    if (!reason) return
    suspendMutation.mutate({ tenantId: tenant.id, reason })
  }

  const handleOpenFlags = (tenant) => {
    setSelectedTenant(tenant)
    setFeatureFlagsValue(JSON.stringify(tenant.feature_flags || {}, null, 2))
    setShowFlagsModal(true)
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
        <p className="text-gray-500">Only Perksu Admins can manage tenants.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Manager</h1>
          <p className="text-sm text-gray-500">Provision, suspend, and monitor tenant health.</p>
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

      {/* Table */}
      {isLoading ? (
        <div className="card">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{tenant.name}</p>
                        <p className="text-sm text-gray-500">{tenant.domain || tenant.slug || '-'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge ${tenant.status === 'active' ? 'badge-success' : tenant.status === 'suspended' ? 'badge-error' : 'badge-warning'}`}>
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-600 capitalize">{tenant.subscription_tier || 'free'}</td>
                    <td className="px-4 py-4 text-gray-600">{tenant.user_count ?? 0}</td>
                    <td className="px-4 py-4 text-right space-x-3">
                      <button
                        onClick={() => handleOpenFlags(tenant)}
                        className="text-sparknode-purple hover:text-sparknode-purple/80 font-medium text-sm"
                      >
                        Flags
                      </button>
                      {tenant.status === 'suspended' ? (
                        <button
                          onClick={() => activateMutation.mutate(tenant.id)}
                          className="text-green-600 hover:text-green-700 font-medium text-sm"
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuspend(tenant)}
                          className="text-red-600 hover:text-red-700 font-medium text-sm"
                        >
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tenants.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No tenants found
            </div>
          )}
        </div>
      )}

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full">
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
                  onClick={() => {
                    setShowFlagsModal(false)
                    setSelectedTenant(null)
                  }}
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
