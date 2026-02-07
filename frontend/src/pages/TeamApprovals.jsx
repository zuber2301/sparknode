import React from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { recognitionApi, usersApi } from '../lib/api'
import api from '../lib/api'

export default function TeamApprovals() {
  const { user, canApproveTeamRecognitions } = useAuthStore()

  if (!canApproveTeamRecognitions()) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card">
          <h2 className="text-lg font-semibold">Not authorized</h2>
          <p className="text-sm text-gray-500">You do not have permissions to approve recognitions.</p>
        </div>
      </div>
    )
  }

  const { data: pendingResp, isLoading, refetch } = useQuery({
    queryKey: ['pendingApprovals', user?.dept_id],
    queryFn: () => recognitionApi.getAll({ status: 'pending', department_id: user?.dept_id }),
    enabled: !!user?.dept_id,
  })

  const items = pendingResp?.data || []

  const handleAction = async (id, action) => {
    try {
      await api.put(`/recognitions/${id}/${action}`)
      refetch()
      toast.success(`${action} successful`)
    } catch (e) {
      toast.error(`Failed to ${action}: ${e?.response?.data?.detail || e?.message || 'error'}`)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-sm text-gray-600 mt-2">Review and approve peer-to-peer nominations from your team (if enabled).</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Pending Recognitions</h2>
        {isLoading ? (
          <p>Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">No pending items.</p>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{it.title || it.summary || 'Recognition'}</div>
                    <div className="text-sm text-gray-600">From: {it.from_name || it.from_email} → To: {it.to_name || it.to_email}</div>
                    <div className="text-xs text-gray-400">{new Date(it.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleAction(it.id, 'approve')} className="px-3 py-1 rounded-md bg-green-600 text-white text-sm">Approve</button>
                    <button onClick={() => handleAction(it.id, 'reject')} className="px-3 py-1 rounded-md bg-red-50 text-red-600 text-sm">Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
