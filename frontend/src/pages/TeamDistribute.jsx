import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetsApi, usersApi } from '../lib/api'

export default function TeamDistribute() {
  const { user, canManageBudgets } = useAuthStore()
  const qc = useQueryClient()
  const [recipient, setRecipient] = useState('')
  const [points, setPoints] = useState(10)

  const { data: leadBudgets } = useQuery({
    queryKey: ['leadBudgets', user?.id],
    queryFn: () => budgetsApi.getLeadBudgets(user.id),
    enabled: !!user?.id,
  })

  const { data: reportsResponse } = useQuery({
    queryKey: ['directReports', user?.id],
    queryFn: () => usersApi.getDirectReports(user.id),
    enabled: !!user?.id,
  })

  const reports = reportsResponse?.data || []

  const allocateMutation = useMutation({
    mutationFn: (payload) => budgetsApi.allocateLeadBudget(payload),
    onSuccess: () => {
      toast.success('Allocated successfully')
      qc.invalidateQueries(['leadBudgets', user?.id])
    },
    onError: (e) => toast.error('Allocation failed: ' + (e?.response?.data?.detail || e?.message || 'error')),
  })

  const handleAllocate = (e) => {
    e.preventDefault()
    if (!recipient) return toast.error('Choose a recipient')
    if (!canManageBudgets()) return toast.error('Not authorized to allocate budgets')
    allocateMutation.mutate({ lead_id: user.id, recipient_id: recipient, points })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold">Distribute</h1>
        <p className="text-sm text-gray-600 mt-2">Quick access to send awards to team members using assigned Dept Budget.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Allocate from Lead Budget</h2>
      <div className="text-sm text-gray-500 mb-3">Available budgets: {leadBudgets?.data?.length || 0}</div>
        <form onSubmit={handleAllocate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={recipient} onChange={(e) => setRecipient(e.target.value)} className="input">
            <option value="">Select recipient</option>
            {reports.map((r) => (
              <option key={r.id} value={r.id}>{r.first_name} {r.last_name} — {r.email}</option>
            ))}
          </select>
          <input type="number" className="input" value={points} onChange={(e) => setPoints(Number(e.target.value))} />
          <div className="flex items-center gap-2">
            <button className="btn btn-primary" type="submit">Allocate</button>
            <span className="text-sm text-gray-500">(Uses Dept/Lead pool)</span>
          </div>
        </form>
      </div>
    </div>
  )
}
