import React from 'react'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { feedApi } from '../lib/api'

export default function TeamActivity() {
  const { user, canGiveRecognition } = useAuthStore()

  if (!canGiveRecognition()) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card">
          <h2 className="text-lg font-semibold">Not authorized</h2>
          <p className="text-sm text-gray-500">You do not have access to the Activity Feed.</p>
        </div>
      </div>
    )
  }

  const { data: feedResponse, isLoading } = useQuery({
    queryKey: ['departmentFeed', user?.department_id],
    queryFn: () => feedApi.getDepartmentFeed({ department_id: user?.department_id, limit: 25 }),
    enabled: !!user?.department_id,
  })

  const items = feedResponse?.data || []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold">Activity Feed</h1>
        <p className="text-sm text-gray-600 mt-2">A social wall of all recognition happening within the specific department.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Recent Recognition</h2>
        {isLoading ? (
          <p>Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">No recent activity.</p>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="font-medium">{it.author_name || it.author_email}</div>
                  <div className="text-sm text-gray-600">{it.summary || it.content}</div>
                </div>
                <div className="text-xs text-gray-400 mt-2">{new Date(it.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
