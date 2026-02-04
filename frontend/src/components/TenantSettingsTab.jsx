import { useState, useEffect, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { platformAPI } from '../lib/api'
import toast from 'react-hot-toast'

// TenantSettingsTab
// Props:
//  - tenant: tenant object with fields described in TenantDetailResponse
//  - onUpdate: callback called after successful update
//  - setMessage: optional function to show page-level messages

export default function TenantSettingsTab({ tenant = {}, onUpdate = () => {}, setMessage = null }) {
  const [loadingLogo, setLoadingLogo] = useState(false)
  const [settings, setSettings] = useState({
    name: tenant.name || '',
    logo_url: tenant.logo_url || '',
    favicon_url: tenant.favicon_url || '',
    theme_config: tenant.theme_config || {
      primary_color: '#3B82F6',
      secondary_color: '#8B5CF6',
      font_family: 'System UI'
    },
    currency_label: tenant.currency_label || tenant.currency || 'Points',
    conversion_rate: tenant.conversion_rate || 1.0,
    auto_refill_threshold: tenant.auto_refill_threshold || 20,
    // store as a single comma-separated string for the UI
    domain_whitelist: (Array.isArray(tenant.domain_whitelist) && tenant.domain_whitelist.length) ? tenant.domain_whitelist.join(', ') : (typeof tenant.domain_whitelist === 'string' ? tenant.domain_whitelist : ''),
    auth_method: tenant.auth_method || 'OTP_ONLY',
    markup_percent: tenant.markup_percent || 0.0,
    enabled_rewards: tenant.enabled_rewards || [],
    redemptions_paused: tenant.redemptions_paused || false,
    award_tiers: tenant.award_tiers || {},
    expiry_policy: tenant.expiry_policy || 'never',
    branding_config: tenant.branding_config || {}
  })

  // Local form helpers
  const [newDomain, setNewDomain] = useState('')
  const [newEnabledReward, setNewEnabledReward] = useState('')

  // Keep state in sync when tenant prop changes
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      name: tenant.name || prev.name,
      logo_url: tenant.logo_url || prev.logo_url,
      favicon_url: tenant.favicon_url || prev.favicon_url,
      theme_config: tenant.theme_config || prev.theme_config,
      // prefer explicit currency_label/currency fields
      currency_label: tenant.currency_label || tenant.currency || prev.currency_label,
      conversion_rate: tenant.conversion_rate || tenant.fx_rate || prev.conversion_rate,
      auto_refill_threshold: tenant.auto_refill_threshold || prev.auto_refill_threshold,
      domain_whitelist: (Array.isArray(tenant.domain_whitelist) && tenant.domain_whitelist.length) ? tenant.domain_whitelist.join(', ') : (typeof tenant.domain_whitelist === 'string' ? tenant.domain_whitelist : prev.domain_whitelist),
      auth_method: tenant.auth_method || prev.auth_method,
      markup_percent: tenant.markup_percent || prev.markup_percent,
      enabled_rewards: tenant.enabled_rewards || prev.enabled_rewards,
      redemptions_paused: tenant.redemptions_paused || prev.redemptions_paused,
      award_tiers: tenant.award_tiers || prev.award_tiers,
      expiry_policy: tenant.expiry_policy || prev.expiry_policy,
      branding_config: tenant.branding_config || prev.branding_config
    }))
  }, [tenant])

  // Mutation to save tenant
  const updateMutation = useMutation({
    mutationFn: (payload) => platformAPI.updateTenant(tenant.id, payload),
    onSuccess: (resp) => {
      toast.success('Tenant settings saved')
      if (typeof onUpdate === 'function') onUpdate(resp.data || resp)
      if (setMessage) setMessage({ type: 'success', text: 'Settings saved' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || err.message || 'Failed to save settings'
      toast.error(msg)
      if (setMessage) setMessage({ type: 'error', text: msg })
    }
  })

  // Logo upload
  const handleUploadLogo = async (file) => {
    if (!file) return
    setLoadingLogo(true)
    try {
      const resp = await platformAPI.uploadLogo(tenant.id, file)
      const logoUrl = resp.data?.logo_url || resp.data?.url || null
      setSettings(prev => ({ ...prev, logo_url: logoUrl }))
      toast.success('Logo uploaded')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to upload logo')
    } finally {
      setLoadingLogo(false)
    }
  }

  const addDomain = () => {
    const d = (newDomain || '').trim()
    if (!d) return
    // Basic validation
    if (!d.startsWith('@') || !d.includes('.')) {
      toast.error("Domain must start with '@' and contain a dot, e.g. @company.com")
      return
    }
    if (settings.domain_whitelist.includes(d)) {
      setNewDomain('')
      return
    }
    setSettings(prev => ({ ...prev, domain_whitelist: [...prev.domain_whitelist, d] }))
    setNewDomain('')
  }

  const removeDomain = (d) => {
    setSettings(prev => ({ ...prev, domain_whitelist: prev.domain_whitelist.filter(x => x !== d) }))
  }

  const addEnabledReward = () => {
    const r = (newEnabledReward || '').trim()
    if (!r) return
    if (settings.enabled_rewards.includes(r)) {
      setNewEnabledReward('')
      return
    }
    setSettings(prev => ({ ...prev, enabled_rewards: [...prev.enabled_rewards, r] }))
    setNewEnabledReward('')
  }

  const removeEnabledReward = (r) => {
    setSettings(prev => ({ ...prev, enabled_rewards: prev.enabled_rewards.filter(x => x !== r) }))
  }

  const handleSave = async () => {
    // Minimal validation
    if (!settings.name) {
      toast.error('Organization name is required')
      return
    }

    // Build payload
    const payload = {
      name: settings.name,
      logo_url: settings.logo_url,
      favicon_url: settings.favicon_url,
      theme_config: settings.theme_config,
      currency: settings.currency_label,
      currency_label: settings.currency_label,
      conversion_rate: settings.conversion_rate,
      auto_refill_threshold: settings.auto_refill_threshold,
      domain_whitelist: (settings.domain_whitelist || '').split(',').map(s => s.trim()).filter(Boolean),
      auth_method: settings.auth_method,
      markup_percent: settings.markup_percent,
      enabled_rewards: settings.enabled_rewards,
      redemptions_paused: settings.redemptions_paused,
      award_tiers: settings.award_tiers,
      expiry_policy: settings.expiry_policy,
      branding_config: settings.branding_config
    }

    updateMutation.mutate(payload)
  }

  const themePreview = useMemo(() => ({
    background: settings.theme_config?.primary_color || '#fff',
    accent: settings.theme_config?.secondary_color || '#000'
  }), [settings.theme_config])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Identity & Branding</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={updateMutation.isLoading}
            className="px-4 py-2 bg-sparknode-purple text-white rounded-lg hover:bg-sparknode-purple/90"
          >
            {updateMutation.isLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="bg-white border rounded p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Organization Name</label>
          <input className="mt-1 w-full px-3 py-2 border rounded" value={settings.name} onChange={e => setSettings(s => ({ ...s, name: e.target.value }))} />

          <label className="block text-sm font-medium text-gray-700 mt-4">Logo</label>
          <div className="flex items-center gap-3 mt-2">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="logo" className="h-12 w-12 object-contain rounded" />
            ) : (
              <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center text-xs">No logo</div>
            )}
            <div>
              <input type="file" accept="image/*" onChange={(e) => handleUploadLogo(e.target.files[0])} />
              {loadingLogo && <div className="text-xs text-gray-500">Uploading...</div>}
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 mt-4">Favicon URL</label>
          <input className="mt-1 w-full px-3 py-2 border rounded" value={settings.favicon_url} onChange={e => setSettings(s => ({ ...s, favicon_url: e.target.value }))} />

          <label className="block text-sm font-medium text-gray-700 mt-4">Theme</label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded" style={{ background: settings.theme_config.primary_color }} />
              <input className="px-3 py-2 border rounded flex-1" value={settings.theme_config.primary_color} onChange={e => setSettings(s => ({ ...s, theme_config: { ...s.theme_config, primary_color: e.target.value } }))} placeholder="#3B82F6" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded" style={{ background: settings.theme_config.secondary_color }} />
              <input className="px-3 py-2 border rounded flex-1" value={settings.theme_config.secondary_color} onChange={e => setSettings(s => ({ ...s, theme_config: { ...s.theme_config, secondary_color: e.target.value } }))} placeholder="#8B5CF6" />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700">Font Family</label>
            <select className="mt-1 w-full px-3 py-2 border rounded" value={settings.theme_config.font_family} onChange={e => setSettings(s => ({ ...s, theme_config: { ...s.theme_config, font_family: e.target.value } }))}>
              <option value="System UI">System UI</option>
              <option value="Inter">Inter</option>
              <option value="Roboto">Roboto</option>
              <option value="Poppins">Poppins</option>
            </select>
          </div>

          <div className="mt-3 p-3 rounded border flex items-center gap-4" style={{ background: themePreview.background }}>
            <div className="w-8 h-8 rounded" style={{ background: themePreview.accent }} />
            <div className="text-sm">Theme preview</div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Currency Label</label>
          <input className="mt-1 w-full px-3 py-2 border rounded" value={settings.currency_label} onChange={e => setSettings(s => ({ ...s, currency_label: e.target.value }))} />

          <label className="block text-sm font-medium text-gray-700 mt-4">Conversion Rate (1 USD = ?)</label>
          <input type="number" step="0.0001" className="mt-1 w-full px-3 py-2 border rounded" value={settings.conversion_rate} onChange={e => setSettings(s => ({ ...s, conversion_rate: e.target.value }))} />

          <label className="block text-sm font-medium text-gray-700 mt-4">Auto-Refill Threshold (%)</label>
          <input type="number" step="0.1" min="0" max="100" className="mt-1 w-full px-3 py-2 border rounded" value={settings.auto_refill_threshold} onChange={e => setSettings(s => ({ ...s, auto_refill_threshold: e.target.value }))} />

          <label className="block text-sm font-medium text-gray-700 mt-4">Auth Method</label>
          <select className="mt-1 w-full px-3 py-2 border rounded" value={settings.auth_method} onChange={e => setSettings(s => ({ ...s, auth_method: e.target.value }))}>
            <option value="OTP_ONLY">OTP Only</option>
            <option value="PASSWORD_AND_OTP">Password + OTP</option>
            <option value="SSO_SAML">SSO / SAML</option>
          </select>

          <label className="block text-sm font-medium text-gray-700 mt-4">Markup Percent (for gift cards)</label>
          <input type="number" step="0.01" className="mt-1 w-full px-3 py-2 border rounded" value={settings.markup_percent} onChange={e => setSettings(s => ({ ...s, markup_percent: e.target.value }))} />

          <label className="block text-sm font-medium text-gray-700 mt-4">Redemptions Paused</label>
          <div className="mt-1">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={settings.redemptions_paused} onChange={e => setSettings(s => ({ ...s, redemptions_paused: e.target.checked }))} />
              <span className="text-sm text-gray-700">Pause all redemptions</span>
            </label>
          </div>

        </div>
      </div>

      {/* Domain Whitelist */}
      <div className="bg-white border rounded p-6">
        <h3 className="font-semibold">Domain Whitelist (Auto-Onboarding)</h3>
          <div className="mt-3">
          <input className="mt-1 w-full px-3 py-2 border rounded" placeholder="@company.com, @subsidiary.example" value={settings.domain_whitelist} onChange={e => setSettings(s => ({ ...s, domain_whitelist: e.target.value }))} />
          <p className="text-xs text-gray-500 mt-1">Comma-separated email domain suffixes allowed for this tenant</p>
        </div>
      </div>

      {/* Enabled Rewards */}
      <div className="bg-white border rounded p-6">
        <h3 className="font-semibold">Enabled Rewards (Whitelist)</h3>
        <div className="mt-3 flex items-center gap-3">
          <input className="px-3 py-2 border rounded flex-1" placeholder="reward-id" value={newEnabledReward} onChange={e => setNewEnabledReward(e.target.value)} />
          <button onClick={addEnabledReward} className="px-3 py-2 bg-gray-100 rounded">Add</button>
        </div>
        <div className="mt-3 space-y-2">
          {settings.enabled_rewards.length === 0 && <div className="text-sm text-gray-500">All rewards enabled</div>}
          {settings.enabled_rewards.map(r => (
            <div key={r} className="flex items-center justify-between p-2 border rounded">
              <div className="text-sm">{r}</div>
              <div>
                <button onClick={() => removeEnabledReward(r)} className="text-sm text-red-600">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recognition Rules */}
      <div className="bg-white border rounded p-6">
        <h3 className="font-semibold">Recognition Rules</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-700">Expiry Policy</label>
            <select className="mt-1 w-full px-3 py-2 border rounded" value={settings.expiry_policy} onChange={e => setSettings(s => ({ ...s, expiry_policy: e.target.value }))}>
              <option value="never">Never</option>
              <option value="90_days">90 Days</option>
              <option value="1_year">1 Year</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700">Award Tiers (JSON)</label>
            <textarea className="mt-1 w-full px-3 py-2 border rounded" rows={4} value={JSON.stringify(settings.award_tiers || {}, null, 2)} onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value)
                setSettings(s => ({ ...s, award_tiers: parsed }))
              } catch (err) {
                // ignore parse errors until save
              }
            }} />
          </div>
        </div>
      </div>

      {/* Branding Config raw editor */}
      <div className="bg-white border rounded p-6">
        <h3 className="font-semibold">Branding & Advanced</h3>
        <label className="block text-sm text-gray-700">Branding Config (JSON)</label>
        <textarea className="mt-1 w-full px-3 py-2 border rounded" rows={6} value={JSON.stringify(settings.branding_config || {}, null, 2)} onChange={e => {
          try {
            const parsed = JSON.parse(e.target.value)
            setSettings(s => ({ ...s, branding_config: parsed }))
          } catch (err) {
            // ignore until save
          }
        }} />
      </div>

    </div>
  )
}
