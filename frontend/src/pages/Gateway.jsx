/**
 * Gateway — dual-experience landing page
 *
 * Shown when a user has (or could have) access to more than one experience.
 * Tenant Manager lands here after login if both experiences are available.
 * Single-experience users are redirected straight to their dashboard.
 */

import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useExperience } from '../context/ExperienceContext'
import { useCurrency } from '../hooks/useCurrency'
import {
  HiOutlineSparkles,
  HiOutlineUsers,
  HiOutlineGift,
  HiOutlineChartBar,
  HiOutlineCalendar,
  HiOutlineTrendingUp,
  HiOutlineLightningBolt,
  HiOutlineArrowRight,
  HiOutlineLockClosed,
  HiOutlineCheckCircle,
} from 'react-icons/hi'

// ─── Feature bullet lists ─────────────────────────────────────────────────────

const ENGAGEMENT_FEATURES = [
  { icon: HiOutlineSparkles, text: 'Peer recognition & kudos' },
  { icon: HiOutlineGift,     text: 'Points, rewards & redemption' },
  { icon: HiOutlineUsers,    text: 'Company values & challenges' },
  { icon: HiOutlineChartBar, text: 'Team feed & social activity' },
  { icon: HiOutlineCalendar, text: 'Company events hub' },
]

const GROWTH_FEATURES = [
  { icon: HiOutlineTrendingUp,    text: 'Sales campaign management' },
  { icon: HiOutlineCalendar,      text: 'Lead-gen & webinar events' },
  { icon: HiOutlineLightningBolt, text: 'Leads dashboard & funnel' },
  { icon: HiOutlineChartBar,      text: 'Event ROI & attribution reports' },
  { icon: HiOutlineSparkles,      text: 'Campaigns with escrow approval' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExperienceCard({ experience, meta, isActive, isLocked, onEnter, onUpgrade }) {
  const colorMap = {
    purple: {
      gradient: 'from-sparknode-purple to-purple-600',
      badge: 'bg-purple-100 text-purple-700',
      ring: 'ring-sparknode-purple',
      btn: 'bg-sparknode-purple hover:bg-purple-700',
      icon: 'text-sparknode-purple',
    },
    blue: {
      gradient: 'from-blue-500 to-indigo-600',
      badge: 'bg-blue-100 text-blue-700',
      ring: 'ring-blue-500',
      btn: 'bg-blue-600 hover:bg-blue-700',
      icon: 'text-blue-600',
    },
  }
  const c = colorMap[meta.color] || colorMap.purple
  const features = experience === 'engagement' ? ENGAGEMENT_FEATURES : GROWTH_FEATURES

  return (
    <div
      className={`relative flex flex-col bg-white rounded-2xl border-2 shadow-lg transition-all duration-300 overflow-hidden
        ${isActive ? `border-sparknode-purple ring-2 ${c.ring} shadow-purple-100` : 'border-gray-200 hover:border-gray-300 hover:shadow-xl'}
        ${isLocked ? 'opacity-90' : ''}
      `}
    >
      {/* Locked overlay */}
      {isLocked && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center rounded-2xl">
          <div className="bg-gray-900/80 text-white rounded-2xl px-8 py-6 text-center shadow-2xl max-w-xs mx-4">
            <HiOutlineLockClosed className="w-10 h-10 mx-auto mb-3 text-yellow-400" />
            <p className="font-bold text-lg mb-1">Pro Plan Required</p>
            <p className="text-sm text-gray-300 mb-4">
              Unlock Growth Events with the Pro plan — campaigns, leads, and ROI tracking.
            </p>
            <button
              onClick={onUpgrade}
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded-xl text-sm transition-colors"
            >
              Upgrade to Pro →
            </button>
          </div>
        </div>
      )}

      {/* Card header */}
      <div className={`bg-gradient-to-br ${c.gradient} p-6 text-white`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-4xl">{meta.icon}</span>
          {isActive && (
            <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">
              Current
            </span>
          )}
        </div>
        <h2 className="text-2xl font-black mt-2">{meta.label}</h2>
        <p className="text-sm text-white/80 mt-1">{meta.description}</p>
      </div>

      {/* Features */}
      <div className="flex-1 px-6 py-5 space-y-3">
        {features.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3">
            <HiOutlineCheckCircle className={`w-5 h-5 flex-shrink-0 ${c.icon}`} />
            <span className="text-sm text-gray-700">{text}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        {!isLocked && (
          <button
            onClick={onEnter}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition-all ${c.btn}`}
          >
            {isActive ? 'Continue' : 'Enter'}
            <HiOutlineArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Gateway page ────────────────────────────────────────────────────────

export default function Gateway() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    activeExperience,
    setExperience,
    availableExperiences,
    experienceMeta,
    isProUser,
  } = useExperience()
  const { currency, symbol } = useCurrency()

  // If only one experience is available, skip the gateway entirely
  useEffect(() => {
    if (availableExperiences.length === 1) {
      navigate(experienceMeta[availableExperiences[0]].href, { replace: true })
    }
  }, [availableExperiences, experienceMeta, navigate])

  const handleEnter = (experience) => {
    setExperience(experience)
    navigate(experienceMeta[experience].href)
  }

  const handleUpgrade = () => {
    navigate('/pricing')
  }

  const allExperiences = ['engagement', 'growth']

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-xl flex items-center justify-center shadow">
            <span className="text-white font-black text-sm">SN</span>
          </div>
          <span className="text-xl font-black bg-gradient-to-r from-sparknode-purple to-sparknode-blue bg-clip-text text-transparent">
            SparkNode
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Hi, <strong>{user?.first_name || user?.email?.split('@')[0]}</strong>
          </span>
          <Link
            to="/dashboard"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip →
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="text-center pt-10 pb-8 px-4">
        <p className="text-sm font-semibold text-sparknode-purple uppercase tracking-widest mb-3">
          Choose your experience
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
          Where are you headed?
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto">
          SparkNode powers two distinct workflows. Pick the one you need — you can switch any time.
        </p>
      </div>

      {/* Experience cards */}
      <div className="flex-1 flex items-start justify-center px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
          {allExperiences.map((exp) => {
            const meta = experienceMeta[exp]
            const isAvailable = availableExperiences.includes(exp)
            return (
              <ExperienceCard
                key={exp}
                experience={exp}
                meta={meta}
                isActive={activeExperience === exp}
                isLocked={!isAvailable}
                onEnter={() => handleEnter(exp)}
                onUpgrade={handleUpgrade}
              />
            )
          })}
        </div>
      </div>

      {/* Footer note */}
      <div className="text-center pb-8 text-xs text-gray-400">
        Both experiences share the same points & wallet infrastructure.{' '}
        <Link to="/pricing" className="text-sparknode-purple hover:underline">
          Compare plans
        </Link>
      </div>
    </div>
  )
}
