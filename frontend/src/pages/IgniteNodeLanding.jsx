/**
 * IgniteNodeLanding — Dedicated landing page for the IgniteNode module.
 *
 * Shown when the active experience is 'growth' or when the tenant only
 * has IgniteNode enabled. Provides quick access to sales events, campaigns,
 * growth events, leads, and analytics.
 */

import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { useExperience } from '../context/ExperienceContext'
import { salesAPI } from '../lib/api'
import {
  HiOutlineCalendar,
  HiOutlineBriefcase,
  HiOutlineLightningBolt,
  HiOutlineTrendingUp,
  HiOutlineClipboardList,
  HiOutlineChartBar,
  HiOutlineArrowRight,
} from 'react-icons/hi'

const QUICK_ACTIONS = [
  { label: 'Sales Events', icon: HiOutlineCalendar, href: '/sales-events', color: 'bg-orange-100 text-orange-600' },
  { label: 'Campaigns', icon: HiOutlineBriefcase, href: '/campaigns', color: 'bg-amber-100 text-amber-600' },
  { label: 'Growth Events', icon: HiOutlineLightningBolt, href: '/growth-events', color: 'bg-red-100 text-red-600' },
  { label: 'Escrow Approvals', icon: HiOutlineClipboardList, href: '/campaigns/escrow', color: 'bg-yellow-100 text-yellow-700' },
  { label: 'Analytics', icon: HiOutlineChartBar, href: '/analytics', color: 'bg-rose-100 text-rose-600' },
]

export default function IgniteNodeLanding() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { hasBothModules } = useExperience()

  const { data: salesEvents } = useQuery({
    queryKey: ['salesEvents', { limit: 5 }],
    queryFn: () => salesAPI?.getEvents?.({ limit: 5 }),
    enabled: !!salesAPI?.getEvents,
    retry: false,
  })

  const firstName = user?.first_name || 'there'
  const eventCount = Array.isArray(salesEvents?.data) ? salesEvents.data.length : Array.isArray(salesEvents) ? salesEvents.length : 0

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-600 rounded-2xl p-6 sm:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🔥</span>
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-orange-100">IgniteNode</span>
              <span className="text-xs font-semibold text-orange-200 ml-2">(Sales &amp; Marketing)</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mb-1">
            Welcome back, {firstName}!
          </h1>
          <p className="text-sm text-orange-100 max-w-lg">
            Your Sales &amp; Marketing platform — manage campaigns, track leads, and drive growth events.
          </p>
          {hasBothModules && (
            <button
              onClick={() => navigate('/gateway')}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full transition-colors"
            >
              Switch to SparkNode <HiOutlineArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">Active Sales Events</span>
            <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center">
              <HiOutlineCalendar className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{eventCount}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Live events</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">Campaigns</span>
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
              <HiOutlineBriefcase className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">—</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Active campaigns</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">Growth</span>
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <HiOutlineTrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">—</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Pipeline value</p>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {QUICK_ACTIONS.map(({ label, icon: Icon, href, color }) => (
            <button
              key={href}
              onClick={() => navigate(href)}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-sm transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
