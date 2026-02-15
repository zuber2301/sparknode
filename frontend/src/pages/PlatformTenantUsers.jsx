import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { usersAPI, platformAPI } from '../lib/api'

export default function PlatformTenantUsers() {
  const { tenantId } = useParams()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: tenantResp, isLoading: tenantLoading } = useQuery({
    queryKey: ['platformTenant', tenantId],
    queryFn: () => platformAPI.getTenantById(tenantId).then(r => r.data),
  })

  const { data: usersResp, isLoading: usersLoading } = useQuery({
    queryKey: ['platformTenantUsers', tenantId, searchTerm, statusFilter],
    queryFn: () => platformAPI.getTenantUsers(tenantId, {
      search: searchTerm || undefined,
      status: statusFilter || undefined
    }).then(r => r.data),
    enabled: !!tenantId,
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => usersAPI.updateUser(userId, data),
    onSuccess: () => {
      toast.success('User updated')
      queryClient.invalidateQueries(['platformTenantUsers', tenantId])
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to update user')
  })

  const users = usersResp || []

  if (tenantLoading || usersLoading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <div className="flex items-center gap-4 mb-2 justify-between">
        <div className="flex items-center gap-4">
          <Link to="/platform/tenants" className="text-gray-500 hover:underline">Tenants</Link>
          <span className="text-gray-400">/</span>
          <Link to={`/platform/tenants/${tenantId}`} className="text-gray-500 hover:underline">{tenantResp?.name}</Link>
          <span className="text-gray-400">/</span>
          <h1 className="text-xl font-bold">Users</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Users ({users.length})</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_INVITE">Pending</option>
              <option value="DEACTIVATED">Deactivated</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                  {user.first_name?.[0]}{user.last_name?.[0]}
                </div>
                <div>
                  <p className="font-medium">{user.first_name} {user.last_name}</p>
                  <p className="text-sm text-gray-500">{user.corporate_email}</p>
                  <p className="text-xs text-gray-400">{user.org_role}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  user.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                  user.status === 'PENDING_INVITE' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {user.status}
                </span>
                <select
                  value={user.org_role}
                  onChange={(e) => updateUserMutation.mutate({
                    userId: user.id,
                    data: { org_role: e.target.value }
                  })}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  disabled={updateUserMutation.isPending}
                >
                  <option value="tenant_user">User</option>
                  <option value="dept_lead">Department Lead</option>
                  <option value="tenant_manager">Tenant Manager</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No users found
          </div>
        )}
      </div>
    </div>
  )
}