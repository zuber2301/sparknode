import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsAPI } from '../lib/api'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts'
import { format } from 'date-fns'
import { 
  HiOutlineTrendingUp, 
  HiOutlineChartBar, 
  HiOutlineColorSwatch,
  HiOutlineLightningBolt
} from 'react-icons/hi'

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

export default function SpendAnalysis() {
  const [period, setPeriod] = useState('monthly')

  const { data: analysis, isLoading } = useQuery({
    queryKey: ['spend-analysis', period],
    queryFn: () => analyticsAPI.getSpendAnalysis({ period_type: period }),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-gray-200 animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-80 bg-gray-100 animate-pulse rounded-2xl" />
          <div className="h-80 bg-gray-100 animate-pulse rounded-2xl" />
        </div>
      </div>
    )
  }

  const { burn_rate_velocity, department_heatmap, award_tier_distribution, total_spent } = analysis?.data || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Spend Analysis</h1>
          <p className="text-gray-500">Insights into your point distribution and budget health</p>
        </div>
        <select 
          value={period} 
          onChange={(e) => setPeriod(e.target.value)}
          className="input w-40"
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      {/* Summary Stat */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-purple-600 text-white p-6 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Total Points Spent</p>
              <h3 className="text-3xl font-bold mt-1">{total_spent ? Number(total_spent).toLocaleString('en-IN') : '0'}</h3>
            </div>
            <HiOutlineTrendingUp className="w-10 h-10 text-purple-300 opacity-50" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Burn Rate Velocity */}
        <div className="card p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <HiOutlineLightningBolt className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-semibold">Burn Rate Velocity</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burn_rate_velocity}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(str) => {
                    try {
                      return format(new Date(str), 'MMM d')
                    } catch (e) {
                      return str
                    }
                  }}
                  fontSize={12}
                  tickMargin={10}
                />
                <YAxis fontSize={12} />
                <Tooltip 
                  labelFormatter={(str) => {
                    try {
                      return format(new Date(str), 'MMMM d, yyyy')
                    } catch (e) {
                      return str
                    }
                  }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="points" 
                  stroke="#8B5CF6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#8B5CF6' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Award Tier Distribution */}
        <div className="card p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <HiOutlineChartBar className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold">Award Tier Distribution</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={award_tier_distribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tier_name" fontSize={11} interval={0} />
                <YAxis fontSize={12} />
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="points" radius={[4, 4, 0, 0]}>
                  {award_tier_distribution?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Departmental Spend Analysis */}
        <div className="card p-6 bg-white rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <HiOutlineColorSwatch className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-semibold">Departmental Spend Analysis</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={department_heatmap}
                    dataKey="points_spent"
                    nameKey="department_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    labelLine={false}
                    label={({department_name, percentage}) => `${department_name} (${percentage}%)`}
                  >
                    {department_heatmap?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
               {department_heatmap?.map((dept, index) => (
                 <div key={dept.department_name} className="flex items-center gap-4">
                   <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                   <div className="flex-1">
                     <div className="flex justify-between mb-1">
                       <span className="text-sm font-medium">{dept.department_name}</span>
                       <span className="text-sm text-gray-500">{Number(dept.points_spent).toLocaleString('en-IN')} pts</span>
                     </div>
                     <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                       <div 
                         className="h-full rounded-full transition-all duration-500" 
                         style={{ 
                           width: `${dept.percentage}%`,
                           backgroundColor: COLORS[index % COLORS.length]
                         }} 
                       />
                     </div>
                   </div>
                 </div>
               ))}
               {department_heatmap?.length === 0 && (
                 <p className="text-center text-gray-500 py-12">No data available for this period</p>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
