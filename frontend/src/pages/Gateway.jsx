/**
 * Gateway — Module Launchpad
 *
 * Shown after login when the user has access to BOTH SparkNode (engagement)
 * and IgniteNode (growth/sales). Single-module tenants are redirected straight
 * to their module without seeing this screen.
 *
 * Routing: /gateway  (standalone, outside the main Layout)
 * Source of truth: ExperienceContext → igniteAccess
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useExperience } from '../context/ExperienceContext'
import { HiOutlineArrowRight } from 'react-icons/hi'

// ─── Feature bullet content ───────────────────────────────────────────────────

const SPARK_FEATURES = [
  'Peer recognition & kudos workflows',
  'Points, rewards & marketplace redemption',
  'Annual gift distribution & approvals',
  'Company events — Annual Day, Sports Day, etc.',
  'Voucher generation & catalog management',
  'Team feed, challenges & company values',
]

const IGNITE_FEATURES = [
  'Sales campaign creation & management',
  'Lead-gen, webinar & external events',
  'Leads dashboard & pipeline tracking',
  'Event ROI & attribution analytics',
  'Campaign escrow & budget approval flows',
  'CRM activity & engagement tracking',
]

// ─── Module card ──────────────────────────────────────────────────────────────

function ModuleCard({ title, subtitle, icon, features, isLastUsed, accentClasses, buttonClasses, dotColor, onEnter }) {
  return (
    <div
      className={`group relative bg-white/5 border border-white/10 rounded-3xl overflow-hidden
        transition-all duration-300 cursor-pointer flex flex-col ${accentClasses.hover}`}
      onClick={onEnter}
    >
      {/* Gradient header */}
      <div className={`${accentClasses.header} p-8 relative flex-shrink-0`}>
        {isLastUsed && (
          <span className="absolute top-4 right-4 text-xs font-bold bg-white/20 text-white px-3 py-1 rounded-full">
            Last used
          </span>
        )}
        <div className="text-5xl mb-4 select-none">{icon}</div>
        <h2 className="text-3xl font-black text-white tracking-tight">{title}</h2>
        <p className={`mt-1 font-semibold text-sm ${accentClasses.subtitle}`}>{subtitle}</p>
      </div>

      {/* Features list */}
      <div className="p-8 flex flex-col flex-1">
        <ul className="space-y-3 mb-8 flex-1">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-slate-300 text-sm leading-snug">
              <span className={`w-1.5 h-1.5 rounded-full mt-[6px] flex-shrink-0 ${dotColor}`} />
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={(e) => { e.stopPropagation(); onEnter() }}
          className={`w-full flex items-center justify-center gap-2 py-4 text-white font-bold rounded-2xl transition-all duration-200 text-sm ${buttonClasses}`}
        >
          Enter {title}
          <HiOutlineArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Gateway() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { activeExperience, setExperience, igniteAccess, sparkAccess, hasBothModules } = useExperience()

  // Single-module tenants skip the launchpad entirely
  useEffect(() => {
    if (!hasBothModules) {
      if (igniteAccess && !sparkAccess) {
        navigate('/ignitenode', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    }
  }, [hasBothModules, igniteAccess, sparkAccess, navigate])

  const handleEnterSpark = () => {
    setExperience('engagement')
    navigate('/dashboard')
  }

  const handleEnterIgnite = () => {
    setExperience('growth')
    navigate('/sales-events')
  }

  const firstName = user?.first_name || user?.corporate_email?.split('@')[0] || 'there'

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30">
            <span className="text-white font-black text-sm">SN</span>
          </div>
          <span className="text-white font-black text-lg tracking-tight">SparkNode</span>
        </div>
        <span className="text-sm text-slate-400">
          Hi, <strong className="text-slate-200 font-semibold">{firstName}</strong>
        </span>
      </div>

      {/* Hero */}
      <div className="text-center pt-14 pb-10 px-4">
        <p className="text-xs font-bold text-violet-400 uppercase tracking-[0.3em] mb-4">
          Choose your workspace
        </p>
        <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tight">
          Where are you headed?
        </h1>
        <p className="text-slate-400 text-lg max-w-lg mx-auto">
          Two focused platforms. One login.
          Pick the one you need — you can switch any time.
        </p>
      </div>

      {/* Module cards */}
      <div className="flex-1 flex items-start justify-center px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">

          {/* SparkNode — Employee Engagement Platform */}
          <ModuleCard
            title="SparkNode"
            subtitle="Employee Engagement Platform (EEP)"
            icon="🎯"
            features={SPARK_FEATURES}
            isLastUsed={activeExperience === 'engagement'}
            accentClasses={{
              hover: 'hover:border-violet-500/50',
              header: 'bg-gradient-to-br from-violet-600 to-purple-700',
              subtitle: 'text-violet-200',
            }}
            dotColor="bg-violet-400"
            buttonClasses="bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-900/50"
            onEnter={handleEnterSpark}
          />

          {/* IgniteNode — Sales & Marketing */}
          <ModuleCard
            title="IgniteNode"
            subtitle="Sales & Marketing"
            icon="🔥"
            features={IGNITE_FEATURES}
            isLastUsed={activeExperience === 'growth'}
            accentClasses={{
              hover: 'hover:border-orange-500/50',
              header: 'bg-gradient-to-br from-orange-500 to-amber-600',
              subtitle: 'text-orange-100',
            }}
            dotColor="bg-orange-400"
            buttonClasses="bg-orange-500 hover:bg-orange-400 shadow-lg shadow-orange-900/50"
            onEnter={handleEnterIgnite}
          />

        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-8 text-xs text-slate-600">
        Both platforms share the same wallet, points & user infrastructure.
      </div>

    </div>
  )
}
