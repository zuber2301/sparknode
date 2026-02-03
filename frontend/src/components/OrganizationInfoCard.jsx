import React from 'react'

export default function OrganizationInfoCard({ tenant }) {
  const fmt = (v) => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'string') return v.trim() ? v.trim() : '—'
    return String(v)
  }

  const pairs = [
    { key: 'Organization Name', value: fmt(tenant?.name) },
    { key: 'Tenant Slug', value: fmt(tenant?.slug || tenant?.domain) },
    { key: 'Primary Contact Email', value: fmt(tenant?.primary_contact_email || tenant?.admin_email) },
    { key: 'Company Domain', value: fmt(tenant?.domain) }
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="text-sm text-gray-700" style={{ fontFamily: 'inherit' }}>
        {pairs.map((p) => (
          <div key={p.key} className="py-1">
            <div className="text-xs text-gray-500">{p.key}</div>
            <div className="text-sm text-gray-900">{p.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
