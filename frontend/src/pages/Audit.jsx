import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { format } from 'date-fns'
import { HiOutlineClipboardList, HiOutlineFilter } from 'react-icons/hi'

export default function Audit() {
  const [filterAction, setFilterAction] = useState('')
  const [filterEntityType, setFilterEntityType] = useState('')
  const [days, setDays] = useState(30)
  const { isHRAdmin } = useAuthStore()

  const { data: logs, isLoading } = useQuery({
    queryKey: ['auditLogs', { action: filterAction, entity_type: filterEntityType, days }],
    queryFn: () => auditAPI.getLogs({
      action: filterAction || undefined,
      entity_type: filterEntityType || undefined,
      days,
    }),
  })

  const { data: actions } = useQuery({
    queryKey: ['auditActions'],
    queryFn: () => auditAPI.getActions(),
  })

  const { data: entityTypes } = useQuery({
    queryKey: ['auditEntityTypes'],
    queryFn: () => auditAPI.getEntityTypes(),
  })

  const getActionColor = (action) => {
    if (action.includes('created')) return 'bg-green-100 text-green-800'
    if (action.includes('updated') || action.includes('allocated')) return 'bg-blue-100 text-blue-800'
    if (action.includes('deleted') || action.includes('revoked')) return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  if (!isHRAdmin()) {
    return (
      <div className="card text-center py-12">
        <HiOutlineClipboardList className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500">Only HR Admins can view audit logs.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <HiOutlineFilter className="w-5 h-5 text-gray-400" />
          <span className="font-medium">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="input"
          >
            <option value="">All Actions</option>
            {actions?.data?.map((action) => (
              <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={filterEntityType}
            onChange={(e) => setFilterEntityType(e.target.value)}
            className="input"
          >
            <option value="">All Entity Types</option>
            {entityTypes?.data?.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="input"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Logs */}
      {isLoading ? (
        <div className="card">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : logs?.data?.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 uppercase">Timestamp</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 uppercase">Actor</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 uppercase">Action</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 uppercase">Entity</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 uppercase">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.data.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {format(new Date(log.created_at), 'MMM d, yyyy')}
                      <br />
                      <span className="text-xs text-gray-400">
                        {format(new Date(log.created_at), 'h:mm a')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-gray-900">
                        {log.actor_name || 'System'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {log.entity_type && (
                        <span className="capitalize">{log.entity_type}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {log.new_values && (
                        <pre className="text-xs bg-gray-100 p-2 rounded max-w-xs overflow-x-auto">
                          {JSON.stringify(log.new_values, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <HiOutlineClipboardList className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No audit logs</h3>
          <p className="text-gray-500">Activity logs will appear here.</p>
        </div>
      )}
    </div>
  )
}
