import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tenantsAPI } from '../lib/api'
import TenantSettingsTab from '../components/TenantSettingsTab'
import { HiOutlineCog } from 'react-icons/hi'

export default function Settings() {
  const [message, setMessage] = useState(null)

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['currentTenant'],
    queryFn: () => tenantsAPI.getCurrent(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sparknode-purple"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-sparknode-purple/10 rounded-lg">
          <HiOutlineCog className="w-6 h-6 text-sparknode-purple" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure your tenant settings and preferences</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <TenantSettingsTab
          tenant={tenant}
          onUpdate={() => {
            // Refresh tenant data after update
            window.location.reload()
          }}
          setMessage={setMessage}
        />
      </div>
    </div>
  )
}