import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { platformAPI } from '../lib/api'

export default function PlatformTenantDetail() {
  const { tenantId } = useParams()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('general')
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

  return (
    <div className="w-full px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/platform/tenants" className="text-gray-500 hover:underline">Tenants</Link>
        <span className="text-gray-400">/</span>
        <h1 className="text-xl font-bold">{tenantResp.name}</h1>
      </div>

      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {['general','economy','subscription'].map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1 rounded-md font-bold ${activeTab===t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => recalcMutation.mutate()}>Recalculate Balances</button>
            <button className="btn-primary" onClick={handleSave}>Save Changes</button>
          </div>
        </div>

        <div>
          {activeTab === 'general' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Organization Name</label>
                <input className="input" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="label">Tenant Slug</label>
                <input className="input" value={form.slug} onChange={(e)=>setForm({...form, slug: e.target.value})} />
                <p className="text-xs text-gray-400 mt-1">Changing slug/domain affects login URLs. Confirm with tenant before saving.</p>
              </div>
              <div>
                <label className="label">Domain</label>
                <input className="input" value={form.domain || ''} onChange={(e)=>setForm({...form, domain: e.target.value})} />
              </div>
              <div>
                <label className="label">Primary Color</label>
                <input type="color" className="w-12 h-10" value={form.theme_config.primary_color || '#3B82F6'} onChange={(e)=>setForm({...form, theme_config:{...form.theme_config, primary_color: e.target.value}})} />
              </div>
            </div>
          )}

          {activeTab === 'economy' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Display Currency</label>
                <select className="input" value={form.currency_label} onChange={(e)=>setForm({...form, currency_label: e.target.value})}>
                  <option>USD</option>
                  <option>INR</option>
                  <option>EUR</option>
                </select>
              </div>
              <div>
                <label className="label">FX Compensation Rate</label>
                <input type="number" step="0.01" className="input" value={form.conversion_rate} onChange={(e)=>setForm({...form, conversion_rate: Number(e.target.value)})} />
                <p className="text-xs text-gray-400">Set the custom FX rate (e.g., 1 USD = 83.50 INR).</p>
              </div>
              <div>
                <label className="label">Budget Ceiling (Monthly)</label>
                <input className="input" value={tenantResp.master_budget_balance || 0} readOnly />
              </div>
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Tier</label>
                <select className="input" value={form.subscription_tier} onChange={(e)=>setForm({...form, subscription_tier: e.target.value})}>
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="label">User Seat Limit</label>
                <input type="number" className="input" value={form.max_users} onChange={(e)=>setForm({...form, max_users: Number(e.target.value)})} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
