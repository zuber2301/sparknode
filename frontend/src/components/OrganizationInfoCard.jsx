import React from 'react'

export default function OrganizationInfoCard({ tenant }) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-100 p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Organization Info</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
        <div>
          <p className="text-xs text-gray-500">Organization Name</p>
          <p className="mt-1 font-medium">{tenant?.name || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Tenant Slug</p>
          <p className="mt-1 font-medium">{tenant?.slug || tenant?.domain || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Primary Contact Email</p>
          <p className="mt-1 font-medium">{tenant?.primary_contact_email || tenant?.admin_email || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Company Domain</p>
          <p className="mt-1 font-medium">{tenant?.domain || '—'}</p>
        </div>
      </div>
    </div>
  )
}
