import React, { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { platformAPI } from '../lib/api'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import OrganizationInfoCard from '../components/OrganizationInfoCard'
import AddBudgetModal from '../components/AddBudgetModal'

export default function PlatformTenantDetail() {
  const { tenantId } = useParams()
  const queryClient = useQueryClient()
  const [showMenu, setShowMenu] = useState(false)
  const [showAddBudget, setShowAddBudget] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [form, setForm] = useState(null)

  const { data: tenantResp, isLoading } = useQuery({
    queryKey: ['platformTenant', tenantId],
    queryFn: () => platformAPI.getTenantById(tenantId).then(r => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: (payload) => platformAPI.updateTenant(tenantId, payload),
    onSuccess: (res) => {
      toast.success('Saved')
      queryClient.invalidateQueries(['platformTenants'])
      queryClient.invalidateQueries(['platformTenant', tenantId])
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to save')
  })

  const recalcMutation = useMutation({
    mutationFn: () => platformAPI.recalculateBalances(tenantId),
    onSuccess: (res) => {
      toast.success('Recalculation queued')
      queryClient.invalidateQueries(['platformTenant', tenantId])
      queryClient.invalidateQueries(['platformTenants'])
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to recalculate')
  })

  React.useEffect(() => {
    if (tenantResp) setForm({
      name: tenantResp.name,
      domain: tenantResp.domain,
      slug: tenantResp.slug,
      theme_config: tenantResp.theme_config || {},
      conversion_rate: Number(tenantResp.conversion_rate || 1),
      currency_label: tenantResp.currency_label || 'Points',
      subscription_tier: tenantResp.subscription_tier || 'starter',
      max_users: tenantResp.max_users || 50
    })
  }, [tenantResp])

  if (isLoading || !form) return (
    <div className="card p-8 text-center">Loading tenant...</div>
  )
  const handleSave = () => {
    const payload = {
      name: form.name,
      domain: form.domain,
      slug: form.slug,
      theme_config: form.theme_config,
      conversion_rate: form.conversion_rate,
      currency_label: form.currency_label,
      subscription_tier: form.subscription_tier,
      max_users: form.max_users
    }
    updateMutation.mutate(payload)
  }

  // Helper metrics (use server-provided aggregates when available)
  const totalAllocated = tenantResp.total_allocated ? Number(tenantResp.total_allocated) : (tenantResp.total_points_distributed ? Number(tenantResp.total_points_distributed) : 0)
  const totalSpent = tenantResp.total_spent ? Number(tenantResp.total_spent) : 0
  const budgetRemaining = Number(tenantResp.master_budget_balance || 0)
  const totalUsers = tenantResp.user_count || 0

  // Role breakdown fallbacks (backend may provide these counts)
  const managerCount = tenantResp.manager_count || tenantResp.managers_count || 0
  const leadCount = tenantResp.lead_count || tenantResp.leads_count || 0
  const employeeCount = tenantResp.employee_count || (totalUsers - managerCount - leadCount) || totalUsers

  // Engagement metrics fallbacks
  const recognitionsThisMonth = tenantResp.recent_recognitions_count || tenantResp.total_recognitions || 0
  const redemptionsThisMonth = tenantResp.recent_redemptions_count || tenantResp.total_redemptions || '—'
  const activeUsersThisWeek = tenantResp.active_user_count || 0
  const avgPointsPerEmployee = totalUsers > 0 ? Math.round((Number(tenantResp.total_points_distributed || 0) || 0) / totalUsers) : 0

  // Budget Activity chart state
  const [budgetPeriod, setBudgetPeriod] = useState('monthly')
  const [intervals, setIntervals] = useState(6)

  const { data: budgetActivityResp, isLoading: budgetLoading } = useQuery({
    queryKey: ['budgetActivity', tenantId, budgetPeriod, intervals],
    queryFn: () => platformAPI.getBudgetActivity(tenantId, { period: budgetPeriod, intervals }).then(r => r.data),
    enabled: !!tenantId,
  })

  const chartData = (budgetActivityResp && budgetActivityResp.data) ? budgetActivityResp.data.map(d => ({ period: d.period, credits: Number(d.credits), debits: Number(d.debits), net: Number(d.net) })) : []

  const chartTotals = useMemo(() => {
    const credits = chartData.reduce((s, d) => s + (d.credits || 0), 0)
    const debits = chartData.reduce((s, d) => s + (d.debits || 0), 0)
    const net = credits - debits
    return { credits, debits, net }
  }, [chartData])

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <div className="flex items-center gap-4 mb-2 justify-between">
        <div className="flex items-center gap-4">
          <Link to="/platform/tenants" className="text-gray-500 hover:underline">Tenants</Link>
          <span className="text-gray-400">/</span>
          <h1 className="text-xl font-bold">{tenantResp.name}</h1>
        </div>

        {/* Action menu */}
        <div className="flex items-center">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full hover:bg-gray-100"
              aria-label="Actions"
            >
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                <Link
                  to={`/platform/tenants/${tenantId}/users`}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowMenu(false)}
                >
                  Manage Users
                </Link>
                <button
                  onClick={() => {
                    setShowAddBudget(true)
                    setShowMenu(false)
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Add Budget
                </button>
                <button
                  onClick={() => {
                    toast('Push Notification functionality (not yet implemented)')
                    setShowMenu(false)
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Push Notification
                </button>
              </div>
            )}

            {showAddBudget && (
              <AddBudgetModal isOpen={showAddBudget} onClose={() => setShowAddBudget(false)} tenantId={tenantId} />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {['Overview','Branding','Security','Economy','Governance'].map((t) => {
          const key = t.toLowerCase()
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1 rounded-md text-sm font-medium ${activeTab===key ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700'}`}
            >
              {t}
            </button>
          )
        })}
      </div>

      {/* Top Metric Cards (Overview) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[12px] text-gray-500 font-bold uppercase tracking-wider">Total Budget Allocated</p>
          <p className="text-2xl font-bold text-gray-900 mt-3">₹{Number(totalAllocated || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-2">Lifetime Allocations</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[12px] text-gray-500 font-bold uppercase tracking-wider">Total Spent</p>
          <p className="text-2xl font-bold text-gray-900 mt-3">₹{Number(totalSpent || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-2">Redeemed / Debited</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[12px] text-gray-500 font-bold uppercase tracking-wider">Budget Remaining</p>
          <p className="text-2xl font-bold text-gray-900 mt-3">₹{Number(budgetRemaining || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-2">Current Master Balance</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[12px] text-gray-500 font-bold uppercase tracking-wider">Total Users</p>
          <p className="text-2xl font-bold text-gray-900 mt-3">{totalUsers}</p>
          <p className="text-xs text-gray-400 mt-2">Managers / Leads / Employees: {managerCount} / {leadCount} / {employeeCount}</p>
        </div>
      </div>

      {/* Branding Tab */}
      {activeTab === 'branding' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold">Branding</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600">Primary Color</label>
              <input type="color" value={form.theme_config?.primary_color || '#4f46e5'} onChange={(e)=>setForm({...form, theme_config: {...form.theme_config, primary_color: e.target.value}})} className="mt-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Logo URL</label>
              <input type="text" value={form.theme_config?.logo_url || ''} onChange={(e)=>setForm({...form, theme_config: {...form.theme_config, logo_url: e.target.value}})} className="mt-2 input" />
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold">Security</h2>
          <div>
            <label className="block text-sm text-gray-600">Auth Method</label>
            <select value={form.auth_method || tenantResp.auth_method || 'sso'} onChange={(e)=>setForm({...form, auth_method: e.target.value})} className="mt-2 input">
              <option value="sso">SSO</option>
              <option value="standard">Standard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600">Domain Whitelist (comma separated)</label>
            <input type="text" value={(form.domain_whitelist && form.domain_whitelist.join(',')) || (tenantResp.domain_whitelist && tenantResp.domain_whitelist.join(',')) || ''} onChange={(e)=>setForm({...form, domain_whitelist: e.target.value.split(',').map(s=>s.trim())})} className="mt-2 input" />
          </div>
        </div>
      )}

      {/* Economy Tab */}
      {activeTab === 'economy' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold">Economy</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600">Currency Label</label>
              <input type="text" value={form.currency_label} onChange={(e)=>setForm({...form, currency_label: e.target.value})} className="mt-2 input" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Conversion Rate</label>
              <input type="number" value={form.conversion_rate} onChange={(e)=>setForm({...form, conversion_rate: Number(e.target.value)})} className="mt-2 input" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Master Budget Balance</label>
              <div className="mt-2 text-lg font-bold">₹{Number(tenantResp.master_budget_balance || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Governance Tab */}
      {activeTab === 'governance' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold">Governance</h2>
          <div>
            <label className="block text-sm text-gray-600">Subscription Tier</label>
            <select value={form.subscription_tier} onChange={(e)=>setForm({...form, subscription_tier: e.target.value})} className="mt-2 input">
              <option value="starter">Starter</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600">Max Users</label>
            <input type="number" value={form.max_users} onChange={(e)=>setForm({...form, max_users: Number(e.target.value)})} className="mt-2 input" />
          </div>
        </div>
      )}

      {/* Engagement Metrics */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <h2 className="text-sm font-bold text-gray-800 mb-4">Engagement Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">RECOGNITIONS THIS MONTH</p>
            <p className="text-lg font-bold text-gray-900 mt-2">{tenantResp.total_recognitions || 0}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">REDEMPTIONS THIS MONTH</p>
            <p className="text-lg font-bold text-gray-900 mt-2">—</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">ACTIVE USERS THIS WEEK</p>
            <p className="text-lg font-bold text-gray-900 mt-2">{tenantResp.active_user_count || 0}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">AVG POINTS PER EMPLOYEE</p>
            <p className="text-lg font-bold text-gray-900 mt-2">₹0</p>
          </div>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Burn Rate Trend (Last 30 Days)</h3>
          <div className="mb-6">
            <OrganizationInfoCard tenant={tenantResp} />
          </div>
<div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button className={`px-3 py-1 rounded-md text-sm ${budgetPeriod==='monthly' ? 'bg-indigo-600 text-white' : 'bg-white border'}`} onClick={() => { setBudgetPeriod('monthly'); setIntervals(6) }}>Monthly</button>
              <button className={`px-3 py-1 rounded-md text-sm ${budgetPeriod==='quarterly' ? 'bg-indigo-600 text-white' : 'bg-white border'}`} onClick={() => { setBudgetPeriod('quarterly'); setIntervals(4) }}>Quarterly</button>
            </div>
            <div className="text-sm text-gray-600">Showing last {intervals} {budgetPeriod === 'monthly' ? 'months' : 'quarters'}</div>
          </div>

          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDebits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="credits" stroke="#10b981" fillOpacity={1} fill="url(#colorCredits)" name="Credits" />
                <Area type="monotone" dataKey="debits" stroke="#f97316" fillOpacity={1} fill="url(#colorDebits)" name="Debits" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 text-center text-sm text-gray-500">
            <div className="flex items-center justify-center gap-6">
              <div>
                <div className="text-xs text-gray-500">Credits</div>
                <div className="font-bold text-gray-900">{chartTotals.credits.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Debits</div>
                <div className="font-bold text-gray-900">{chartTotals.debits.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Net</div>
                <div className="font-bold text-gray-900">{chartTotals.net.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

    </div>
  )
}
