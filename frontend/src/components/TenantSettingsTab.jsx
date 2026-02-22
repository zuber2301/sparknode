import React, { useState } from 'react';
import { platformAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { formatDisplayValue } from '../lib/currency';
import './TenantSettingsTab.css';

export default function TenantSettingsTab({ tenant, onUpdate, setMessage }) {
  const [formData, setFormData] = useState({
    name: tenant.name,
    logo_url: tenant.logo_url || '',
    favicon_url: tenant.favicon_url || '',
    theme_config: tenant.theme_config || {
      primary_color: '#007bff',
      secondary_color: '#6c757d',
      font_family: 'system-ui',
    },
    domain_whitelist: (tenant.domain_whitelist || []).join(', '),
    auth_method: tenant.auth_method,
    currency_label: tenant.currency_label,
    conversion_rate: tenant.conversion_rate,
    auto_refill_threshold: tenant.auto_refill_threshold,
    peer_to_peer_enabled: tenant.peer_to_peer_enabled,
    expiry_policy: tenant.expiry_policy,
  });

  const [saving, setSaving] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleThemeChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      theme_config: {
        ...prev.theme_config,
        [name]: value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData = {
        name: formData.name,
        logo_url: formData.logo_url,
        favicon_url: formData.favicon_url,
        theme_config: formData.theme_config,
        domain_whitelist: formData.domain_whitelist
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
        auth_method: formData.auth_method,
        currency_label: formData.currency_label,
        conversion_rate: parseFloat(formData.conversion_rate),
        auto_refill_threshold: parseFloat(formData.auto_refill_threshold),
        peer_to_peer_enabled: formData.peer_to_peer_enabled,
        expiry_policy: formData.expiry_policy,
      };

      await platformAPI.updateTenant(tenant.id, updateData);
      toast.success('Tenant settings updated successfully');
      if (setMessage) {
        setMessage({
          type: 'success',
          text: 'Tenant settings updated successfully',
        });
      }
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to update settings';
      toast.error(errorMsg);
      if (setMessage) {
        setMessage({
          type: 'error',
          text: errorMsg,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tab-settings">
      <form onSubmit={handleSubmit} className="settings-form">
        {/* Identity & Branding Section */}
        <div className="form-section">
          <h2>Identity & Branding</h2>
          <div className="form-group">
            <label>Tenant Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Triton Energy"
              required
            />
          </div>

          <div className="form-group">
            <label>Logo URL</label>
            <input
              type="url"
              name="logo_url"
              value={formData.logo_url}
              onChange={handleInputChange}
              placeholder="https://example.com/logo.png"
            />
            {formData.logo_url && (
              <div className="preview-box">
                <img src={formData.logo_url} alt="Logo" className="preview-img" />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Favicon URL</label>
            <input
              type="url"
              name="favicon_url"
              value={formData.favicon_url}
              onChange={handleInputChange}
              placeholder="https://example.com/favicon.ico"
            />
          </div>

          <div className="theme-config">
            <h3>Theme Configuration</h3>
            <div className="form-group">
              <label>Primary Color</label>
              <div className="color-input-group">
                <input
                  type="color"
                  name="primary_color"
                  value={formData.theme_config.primary_color}
                  onChange={handleThemeChange}
                />
                <input
                  type="text"
                  value={formData.theme_config.primary_color}
                  onChange={handleThemeChange}
                  name="primary_color"
                  placeholder="#007bff"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Secondary Color</label>
              <div className="color-input-group">
                <input
                  type="color"
                  name="secondary_color"
                  value={formData.theme_config.secondary_color}
                  onChange={handleThemeChange}
                />
                <input
                  type="text"
                  value={formData.theme_config.secondary_color}
                  onChange={handleThemeChange}
                  name="secondary_color"
                  placeholder="#6c757d"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Font Family</label>
              <select
                name="font_family"
                value={formData.theme_config.font_family}
                onChange={handleThemeChange}
              >
                <option value="system-ui">System UI</option>
                <option value="Arial">Arial</option>
                <option value="Georgia">Georgia</option>
                <option value="Trebuchet MS">Trebuchet MS</option>
              </select>
            </div>
          </div>
        </div>

        {/* Governance & Security Section */}
        <div className="form-section">
          <h2>Governance & Security</h2>
          <div className="form-group">
            <label>Domain Whitelist</label>
            <input
              type="text"
              name="domain_whitelist"
              value={formData.domain_whitelist}
              onChange={handleInputChange}
              placeholder="@company.com, @company-intl.io"
              title="Comma-separated email domain suffixes"
            />
            <small>Comma-separated email domain suffixes allowed for this tenant</small>
          </div>

          <div className="form-group">
            <label>Authentication Method</label>
            <select
              name="auth_method"
              value={formData.auth_method}
              onChange={handleInputChange}
            >
              <option value="OTP_ONLY">OTP Only (Passwordless)</option>
              <option value="PASSWORD_AND_OTP">Password + OTP</option>
              <option value="SSO_SAML">SSO/SAML</option>
            </select>
          </div>
        </div>

        {/* Point Economy Section */}
        <div className="form-section">
          <h2>Point Economy</h2>
          <div className="form-group">
            <label>Currency Label</label>
            <input
              type="text"
              name="currency_label"
              value={formData.currency_label}
              onChange={handleInputChange}
              placeholder="e.g., Triton Credits"
            />
          </div>

          <div className="form-group">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Conversion Rate ({formatDisplayValue(1, tenant?.display_currency || 'INR')} = X Points)</label>
            <input
              type="number"
              name="conversion_rate"
              value={formData.conversion_rate}
              onChange={handleInputChange}
              step="0.01"
              min="0.01"
            />
          </div>

          <div className="form-group">
            <label>Auto-Refill Threshold (%)</label>
            <input
              type="number"
              name="auto_refill_threshold"
              value={formData.auto_refill_threshold}
              onChange={handleInputChange}
              step="1"
              min="1"
              max="100"
            />
          </div>
        </div>

        {/* Recognition Laws Section */}
        <div className="form-section">
          <h2>Recognition Rules</h2>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                name="peer_to_peer_enabled"
                checked={formData.peer_to_peer_enabled}
                onChange={handleInputChange}
              />
              Allow Peer-to-Peer Recognition
            </label>
          </div>

          <div className="form-group">
            <label>Points Expiry Policy</label>
            <select
              name="expiry_policy"
              value={formData.expiry_policy}
              onChange={handleInputChange}
            >
              <option value="90_days">90 Days</option>
              <option value="180_days">180 Days</option>
              <option value="1_year">1 Year</option>
              <option value="never">Never</option>
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
