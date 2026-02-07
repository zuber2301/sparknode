import React from 'react'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../lib/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function TeamAnalytics() {
  const { user, canViewAnalytics } = useAuthStore()

  if (!canViewAnalytics()) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card">
          <h2 className="text-lg font-semibold">Not authorized</h2>
          <p className="text-sm text-gray-500">You do not have access to Analytics.</p>
        </div>
      </div>
    )
  }

  const { data: metricsResp, isLoading: metricsLoading } = useQuery({
    queryKey: ['departmentMetrics', user?.dept_id],
    queryFn: () => analyticsApi.getDepartmentMetrics(user?.dept_id),
    enabled: !!user?.dept_id,
  })

  const { data: trendsResp, isLoading: trendsLoading } = useQuery({
    queryKey: ['departmentTrends', user?.dept_id],
    queryFn: () => analyticsApi.getDailyTrends({ department_id: user?.dept_id, period: '30d' }),
    enabled: !!user?.dept_id,
  })

  const metrics = metricsResp?.data || {}
  const trends = trendsResp?.data || []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-gray-600 mt-2">Simple "Team Morale" charts showing recognition frequency.</p>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Team Morale</h2>
        {metricsLoading || trendsLoading ? (
          <p>Loading...</p>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="stat-card">
                <p className="text-sm text-gray-500">Recognitions</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.total_recognitions || 0}</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-gray-500">Active Recognizers</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.active_recognizers || 0}</p>
              </div>
            </div>

            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
