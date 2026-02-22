import React from 'react'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { usersApi, deptDashboardApi } from '../lib/api'

export default function TeamDistribute() {
  const { user } = useAuthStore()

  const { data: deptSummary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['deptSummary'],
    queryFn: () => deptDashboardApi.getDeptSummary(),
    enabled: !!user?.id,
  })

  const { data: reportsResponse, isLoading: isLoadingReports } = useQuery({
    queryKey: ['directReports', user?.id],
    queryFn: () => usersApi.getDirectReports(user.id),
    enabled: !!user?.id,
  })

  const reports = reportsResponse?.data || []
  const summary = deptSummary?.data || deptSummary || {}

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold">Team Budget</h1>
        <p className="text-sm text-gray-600 mt-2">
          Department budget overview and team members.
        </p>
      </div>

      {/* Department Budget Summary */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Department Budget</h2>
        {isLoadingSummary ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Allocated</p>
              <p className="text-xl font-semibold text-blue-600">
                {summary.department_budget_allocated ?? summary.allocated_points ?? '—'}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Remaining</p>
              <p className="text-xl font-semibold text-green-600">
                {summary.department_budget_remaining ?? summary.remaining_points ?? '—'}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Spent</p>
              <p className="text-xl font-semibold text-purple-600">
                {summary.department_budget_spent ?? summary.spent_points ?? '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Direct Reports */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Team Members</h2>
        {isLoadingReports ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : reports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Role</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{r.email || r.corporate_email}</td>
                    <td className="py-3 px-4 text-sm text-gray-500 capitalize">{r.org_role?.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No direct reports found.</p>
        )}
      </div>
    </div>
  )
}
