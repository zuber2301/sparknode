import React from 'react'
import { useNavigate } from 'react-router-dom'
import { HiOutlinePlusCircle, HiOutlineDocumentArrowDown, HiOutlineArrowUpCircle, HiOutlineChartPie } from 'react-icons/hi2'

export default function ActionSidebar({ onDistributeClick, onTopupClick, onExportReport, stats }) {
  const navigate = useNavigate()
  const actions = [
    {
      title: 'Distribute Points',
      description: 'Send points to a Lead or User',
      icon: HiOutlinePlusCircle,
      color: 'bg-blue-600',
      onClick: onDistributeClick,
    },
    {
      title: 'Budget Distribution',
      description: 'Dept per-user or tenant-wide allocations',
      icon: HiOutlineChartPie,
      color: 'bg-sparknode-purple',
      onClick: () => navigate('/budget/distribute'),
    },
    {
      title: 'Top-up Request',
      description: 'Request more points from admin',
      icon: HiOutlineArrowUpCircle,
      color: 'bg-amber-400',
      onClick: onTopupClick,
    },
    {
      title: 'Export Report',
      description: 'Download monthly transactions',
      icon: HiOutlineDocumentArrowDown,
      color: 'bg-green-600',
      onClick: onExportReport,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Quick Actions</h3>
        <div className="space-y-4">
          {actions.map((action) => (
            <button
              key={action.title}
              onClick={action.onClick}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-50 hover:bg-gray-50 hover:border-gray-100 transition group text-left"
            >
              <div className={`p-2.5 rounded-lg ${action.color} text-white shadow-sm`}>
                <action.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-none mb-1">{action.title}</p>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-tight">{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-blue-200/50 shadow-lg">
        <h4 className="text-sm font-bold mb-6 flex items-center gap-2">
          At a Glance
        </h4>
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mb-1">Active Users</p>
            <p className="text-2xl font-black">{stats?.active_users_count || 0}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mb-1">Available to Distribute</p>
            <p className="text-2xl font-black">{stats?.master_pool?.toLocaleString('en-IN') || 0} <span className="text-xs font-medium">points</span></p>
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-blue-100 uppercase tracking-widest mb-2">
              <span>Employee Participation</span>
            </div>
            <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: '45%' }} />
            </div>
            <p className="text-[10px] font-medium text-blue-100 mt-2 italic">3 of ~500 employees</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Need Help?</h5>
        <p className="text-xs text-gray-500 leading-relaxed">Explore our documentation for detailed guides and best practices.</p>
        <button className="text-[10px] font-bold text-sparknode-purple uppercase tracking-widest mt-2 hover:underline">View Documentation →</button>
      </div>
    </div>
  )
}
