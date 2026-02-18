import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import ConfirmModal from '../components/ConfirmModal'
import AddBudgetModal from '../components/AddBudgetModal'
import { useAuthStore } from '../store/authStore'
import { tenantsAPI, platformAPI } from '../lib/api'
import { HiOutlinePlus, HiOutlineSearch, HiOutlineDotsVertical, HiOutlineChevronLeft, HiOutlineX, HiOutlineCheckCircle, HiOutlineShieldCheck, HiOutlineCurrencyRupee, HiOutlineLockClosed } from 'react-icons/hi'

export default function TenantDashboard() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user, getEffectiveRole } = useAuthStore()
  const effectiveRole = getEffectiveRole()

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['tenant', slug],
    queryFn: () => tenantsAPI.getBySlug(slug),
    enabled: !!slug,
  })

  // If platform admin, show full tenant dashboard (list + actions)
  const { data: tenantsResponse } = useQuery({
    queryKey: ['platformTenantsForLanding'],
    queryFn: () => platformAPI.getTenants(),
    enabled: effectiveRole === 'platform_admin',
  })
  const queryClient = useQueryClient()
  const { data: metricsResponse } = useQuery({
    queryKey: ['platformMetricsForLanding'],
    queryFn: () => platformAPI.getMetrics(),
    enabled: effectiveRole === 'platform_admin',
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTenantId, setSelectedTenantId] = useState(tenant?.id || null)
  const [actionOpenFor, setActionOpenFor] = useState(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [confirmProps, setConfirmProps] = useState({})
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false)
  const [budgetTarget, setBudgetTarget] = useState(null)

  useEffect(() => {
    if (tenant && isAuthenticated && user) {
      // If user is tenant member, redirect to their dashboard
      if (user.tenant_id === tenant.id) {
        navigate('/dashboard', { replace: true })
        return
      }
      // If platform admin, stay on this page and render admin dashboard
    }
  }, [tenant, isAuthenticated, user, navigate])

  const tenants = useMemo(() => {
    if (!tenantsResponse) return []
    const data = Array.isArray(tenantsResponse?.data) ? tenantsResponse.data : (Array.isArray(tenantsResponse) ? tenantsResponse : [])
    if (!searchQuery) return data
    const q = searchQuery.toLowerCase()
    return data.filter(t => (t.name||'').toLowerCase().includes(q) || (t.slug||'').toLowerCase().includes(q) || (t.domain||'').toLowerCase().includes(q))
  }, [tenantsResponse, searchQuery])

  const stats = useMemo(() => {
    const metrics = metricsResponse?.data || metricsResponse || {}
    const totalTenants = metrics.total_tenants ?? tenants.length
    const activeTenants = metrics.active_tenants ?? tenants.filter(t => t.status === 'active').length
    const enterpriseTenants = metrics.tier_breakdown?.enterprise ?? tenants.filter(t => t.subscription_tier === 'enterprise').length
    const totalBalance = tenants.reduce((acc, t) => acc + (Number(t.master_budget_balance) || 0), 0)
    return { totalTenants, activeTenants, enterpriseTenants, totalBalance }
  }, [metricsResponse, tenants])

  const handleAction = (type, t) => {
    setActionOpenFor(null)

    if (type === 'load') {
      setBudgetTarget(t)
      setIsAddBudgetOpen(true)
      return
    }

    if (type === 'suspend') {
      setConfirmProps({
        title: `Suspend ${t.name}`,
        description: 'Suspend will restrict access for this tenant. This action can be reversed by an admin.',
        onConfirm: () => {
          setIsConfirmOpen(false)
          suspendMutation.mutate({ tenantId: t.id, reason: confirmProps.reason || 'Suspended by admin' })
        }
      })
      setIsConfirmOpen(true)
      return
    }
  }

  const addBudgetMutation = useMutation({
    mutationFn: ({ tenantId, payload }) => platformAPI.addMasterBudget(tenantId, payload),
    onSuccess: () => {
      toast.success('Budget added')
      queryClient.invalidateQueries(['platformTenantsForLanding'])
      queryClient.invalidateQueries(['platformTenants'])
      setIsAddBudgetOpen(false)
      setBudgetTarget(null)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to add budget')
  })

  const suspendMutation = useMutation({
    mutationFn: ({ tenantId, reason }) => platformAPI.suspendTenant(tenantId, reason),
    onSuccess: () => {
      toast.success('Tenant suspended')
      queryClient.invalidateQueries(['platformTenantsForLanding'])
      queryClient.invalidateQueries(['platformTenants'])
      setIsConfirmOpen(false)
      setConfirmProps({})
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to suspend tenant')
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tenant...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Tenant Not Found</h1>
          <p className="text-gray-600 mb-4">The tenant "{slug}" could not be found.</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (!tenant) return null

  // If current user is platform admin, render full tenant dashboard for platform-level management
  if (effectiveRole === 'platform_admin') {
    return (
      <div className="w-full px-2 lg:px-4 py-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tenant Dashboard</h1>
            <p className="text-sm text-gray-500">Global oversight of all platform organizations</p>
          </div>
          <button onClick={() => navigate('/platform/tenants')} className="bg-indigo-600 text-white px-4 py-2 rounded">Open Management</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border shadow-sm">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Tenants</p>
            <p className="text-xl font-bold text-gray-900">{stats.totalTenants}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border shadow-sm">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active Orgs</p>
            <p className="text-xl font-bold text-gray-900">{stats.activeTenants}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border shadow-sm">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Enterprise Tier</p>
            <p className="text-xl font-bold text-gray-900">{stats.enterpriseTenants}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border shadow-sm">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Balance</p>
            <p className="text-xl font-bold text-gray-900">₹{stats.totalBalance.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 bg-gray-50 rounded p-2 flex-1">
              <HiOutlineSearch className="w-5 h-5 text-gray-400" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tenants by name or slug..." className="bg-transparent w-full outline-none text-sm" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Slug</th>
                  <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Tier</th>
                  <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-5 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {tenants.map(t => (
                  <tr key={t.id} className={`group ${t.id === tenant.id ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">{t.name?.charAt(0)}</div>
                        <div>
                          <div onClick={() => navigate('/platform/tenants', { state: { selectedTenantId: t.id } })} className="text-sm font-bold text-indigo-600 hover:underline cursor-pointer">{t.name}</div>
                          <div className="text-xs text-gray-400">ID: {String(t.id).slice(0,10)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.slug || t.domain}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{t.subscription_tier}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">₹{Number(t.master_budget_balance||0).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right relative">
                      <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                        <HiOutlineDotsVertical className="w-5 h-5 transition-transform group-hover:scale-110" />
                      </button>
                      {actionOpenFor === t.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-lg shadow-lg z-50 p-1">


                          <button onClick={() => handleAction('load', t)} className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                            <HiOutlineCurrencyRupee className="w-4 h-4 text-gray-400" />
                            <span>Load Budget</span>
                          </button>

                          <button onClick={() => handleAction('suspend', t)} className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md">
                            <HiOutlineLockClosed className="w-4 h-4 text-red-500" />
                            <span>Suspend</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
            // If confirmProps supplied an onConfirm function, call it. Otherwise, close.
            if (typeof confirmProps.onConfirm === 'function') confirmProps.onConfirm()
            else setIsConfirmOpen(false)
          }}
        />
      </div>
    )
  }

  // Non-admin public landing
  return (
    <div className="min-h-screen px-4 py-10 bg-gray-50">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to {tenant.name}</h1>
        <p className="text-gray-600 mb-6">This is the public tenant page. Sign in to access tenant-specific features.</p>
        <div className="flex justify-center gap-3">
          <a href="/login" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Sign in</a>
          <a href="/signup" className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50">Sign up</a>
        </div>
      </div>
    </div>
  )
}