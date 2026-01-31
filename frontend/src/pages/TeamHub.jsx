import React from 'react'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { usersApi } from '../lib/api'
import { NavLink } from 'react-router-dom'

export default function TeamHub() {
  const { user, canGiveRecognition } = useAuthStore()

  if (!canGiveRecognition()) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card">
          <h2 className="text-lg font-semibold">Not authorized</h2>
          <p className="text-sm text-gray-500">You do not have access to the Team Hub.</p>
        </div>
      </div>
    )
  }

  const { data: reportsResponse, isLoading } = useQuery({
    queryKey: ['directReports', user?.id],
    queryFn: () => usersApi.getDirectReports(user.id),
    enabled: !!user?.id,
  })

  const reports = reportsResponse?.data || []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold">Team Hub</h1>
        <p className="text-sm text-gray-600 mt-2">A dedicated view of direct reports' milestones (anniversaries, birthdays).</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Direct Reports</h2>
        {isLoading ? (
          <p>Loading...</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-gray-500">No direct reports found.</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">{r.first_name} {r.last_name}</div>
                  <div className="text-sm text-gray-500">{r.email} {r.department_id ? `• ${r.department_name || ''}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <NavLink
                    to={`/recognize?to=${r.id}`}
                    className="px-3 py-1.5 rounded-md bg-sparknode-purple text-white text-sm"
                  >
                    Recognize
                  </NavLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
