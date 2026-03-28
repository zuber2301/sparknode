/**
 * SparkNodeLanding — Dedicated landing page for SparkNode EEP module.
 *
 * Shown when the active experience is 'engagement'. Provides quick access
 * to recognition, rewards, events, and team engagement features.
 */

import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { walletsAPI, recognitionAPI, feedAPI } from '../lib/api'
import { useExperience } from '../context/ExperienceContext'
import { formatPoints } from '../lib/currency'
import {
  HiOutlineSparkles,
  HiOutlineGift,
  HiOutlineTrendingUp,
  HiOutlineNewspaper,
  HiOutlineCalendar,
  HiOutlineCash,
  HiOutlineLightningBolt,
  HiOutlineArrowRight,
} from 'react-icons/hi'

const QUICK_ACTIONS = [
  { label: 'Recognize a peer', icon: HiOutlineSparkles, href: '/recognize', color: 'bg-violet-100 text-violet-600' },
  { label: 'Redeem rewards', icon: HiOutlineGift, href: '/redeem', color: 'bg-pink-100 text-pink-600' },
  { label: 'Browse events', icon: HiOutlineCalendar, href: '/events/browse', color: 'bg-blue-100 text-blue-600' },
  { label: 'Activity feed', icon: HiOutlineNewspaper, href: '/feed', color: 'bg-green-100 text-green-600' },
  { label: 'My wallet', icon: HiOutlineCash, href: '/wallet', color: 'bg-amber-100 text-amber-600' },
  { label: 'Challenges', icon: HiOutlineLightningBolt, href: '/challenges', color: 'bg-orange-100 text-orange-600' },
]

export default function SparkNodeLanding() {
  const navigate = useNavigate()
  const { user, tenantContext } = useAuthStore()
  const { hasBothModules } = useExperience()
  const displayCurrency = tenantContext?.display_currency || 'INR'

  const { data: wallet } = useQuery({
    queryKey: ['myWallet'],
    queryFn: () => walletsAPI.getMyWallet(),
  })

  const { data: stats } = useQuery({
    queryKey: ['myRecognitionStats'],
    queryFn: () => recognitionAPI.getMyStats(),
  })

  const firstName = user?.first_name || 'there'

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🎯</span>
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-violet-200">SparkNode EEP</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mb-1">
            Welcome back, {firstName}!
          </h1>
          <p className="text-sm text-violet-200 max-w-lg">
            Your Employee Engagement Platform — recognize peers, redeem rewards, and stay connected with your team.
          </p>
          {hasBothModules && (
            <button
              onClick={() => navigate('/gateway')}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full transition-colors"
            >
              Switch to IgniteNode <HiOutlineArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">Points Balance</span>
            <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
              <HiOutlineCash className="w-5 h-5 text-violet-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{formatPoints(wallet?.balance || 0, displayCurrency)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Available to spend</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">Given</span>
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
              <HiOutlineSparkles className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{stats?.recognitions_given || 0}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Recognitions you've sent</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">Received</span>
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <HiOutlineTrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{stats?.recognitions_received || 0}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Recognitions received</p>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map(({ label, icon: Icon, href, color }) => (
            <button
              key={href}
              onClick={() => navigate(href)}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-violet-300 hover:shadow-sm transition-all group"
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
