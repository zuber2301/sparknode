import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsAPI, tenantsAPI } from '../lib/api'
import { HiOutlineChartBar, HiOutlineTrendingUp, HiOutlineCurrencyDollar, HiOutlineUsers } from 'react-icons/hi'

export default function Analytics() {
  const [period, setPeriod] = useState('30d')

  const { data: spendAnalysis, isLoading: spendLoading } = useQuery({
    queryKey: ['spendAnalysis', period],
    queryFn: () => analyticsAPI.getSpendAnalysis({ period_type: period }),
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => tenantsAPI.getDepartments(),
  })

  const periods = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ]

  if (spendLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sparknode-purple"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600">Insights into recognition activity and spending patterns</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sparknode-purple focus:border-transparent"
          >
            {periods.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <HiOutlineCurrencyDollar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900">
                ${spendAnalysis?.total_spent?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <HiOutlineTrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Recognitions</p>
              <p className="text-2xl font-bold text-gray-900">
                {spendAnalysis?.total_recognitions?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <HiOutlineUsers className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {spendAnalysis?.active_users?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <HiOutlineChartBar className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Avg per Recognition</p>
              <p className="text-2xl font-bold text-gray-900">
                ${spendAnalysis?.avg_points_per_recognition?.toFixed(0) || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Department Breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Department Spending</h2>
          {spendAnalysis?.department_breakdown?.length > 0 ? (
            <div className="space-y-4">
              {spendAnalysis.department_breakdown.map((dept) => (
                <div key={(dept.dept_id || dept.department_id)} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {departments?.data?.find(d => d.id === (dept.dept_id || dept.department_id))?.name || `Department ${dept.dept_id || dept.department_id}`}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {dept.recognitions_count} recognitions
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${dept.total_spent}</p>
                    <p className="text-sm text-gray-500">
                      {dept.percentage_of_total}% of total
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No department data available for this period</p>
          )}
        </div>
      </div>

      {/* Placeholder for additional analytics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Recognition Trends</h3>
            <p className="text-sm text-gray-500">Coming soon - Track recognition patterns over time</p>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">User Engagement</h3>
            <p className="text-sm text-gray-500">Coming soon - Monitor user participation metrics</p>
          </div>
        </div>
      </div>
    </div>
  )
}