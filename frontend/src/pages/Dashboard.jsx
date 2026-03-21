import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { walletsAPI, recognitionAPI, feedAPI } from '../lib/api'
import {
  HiOutlineSparkles, HiOutlineGift, HiOutlineTrendingUp, HiOutlineUsers,
  HiOutlineStar, HiOutlineArrowRight, HiOutlineClock,
} from 'react-icons/hi'
import { HiNewspaper } from 'react-icons/hi'
import WalletBalance from '../components/WalletBalance'
import FeedCard from '../components/FeedCard'
import AdminDashboard from './AdminDashboard'
import MorningBriefing from '../components/MorningBriefing'
import RecognitionModal from '../components/RecognitionModal'
import { formatPoints } from '../lib/currency'

// ── helpers ──────────────────────────────────────────────────────────────────
function getInitials(user) {
  const a = user?.first_name?.[0] || ''
  const b = user?.last_name?.[0] || ''
  if (a || b) return (a + b).toUpperCase()
  return (user?.email?.[0] || 'U').toUpperCase()
}

function getFirstName(user) {
  if (user?.first_name) return user.first_name
  return user?.email?.split('@')[0]
    ?.split(/[_.\-]+/)?.[0]
    ?.replace(/^\w/, c => c.toUpperCase()) || 'there'
}

const STAT_COLOURS = {
  blue:   { wrap: 'bg-blue-50 border border-blue-100',   label: 'text-blue-500',  num: 'text-blue-900',   sub: 'text-blue-400'   },
  purple: { wrap: 'bg-purple-50 border border-purple-100', label: 'text-purple-500', num: 'text-purple-900', sub: 'text-purple-400' },
  amber:  { wrap: 'bg-amber-50 border border-amber-100',  label: 'text-amber-600', num: 'text-amber-900',  sub: 'text-amber-400'  },
}

function StatMini({ label, value, sub, icon, colour = 'purple' }) {
  const c = STAT_COLOURS[colour]
  return (
    <div className={`rounded-xl p-4 ${c.wrap}`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs font-semibold uppercase tracking-wider ${c.label}`}>{label}</p>
        <span className={`text-lg leading-none ${c.label}`}>{icon}</span>
      </div>
      <p className={`text-2xl lg:text-3xl font-bold leading-none ${c.num}`}>{value}</p>
      <p className={`text-xs mt-1.5 truncate ${c.sub}`}>{sub}</p>
    </div>
  )
}

const EXPIRY_LABELS = {
  '90_days': '90 days',
  '1_year': '1 year',
  'custom': 'a limited time',
}

// ── component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, isPlatformOwnerUser, getEffectiveRole, tenantContext } = useAuthStore()
  const navigate = useNavigate()
  const [showRecognitionModal, setShowRecognitionModal] = useState(false)

  const isPlatformUser = isPlatformOwnerUser()
  const effectiveRole = getEffectiveRole()

  // All hooks must run before any early return
  const { data: wallet } = useQuery({
    queryKey: ['myWallet'],
    queryFn: () => walletsAPI.getMyWallet(),
  })

  const { data: stats } = useQuery({
    queryKey: ['myRecognitionStats'],
    queryFn: () => recognitionAPI.getMyStats(),
  })

  const { data: feed } = useQuery({
    queryKey: ['feed', { limit: 5 }],
    queryFn: () => feedAPI.getAll({ limit: 5 }),
  })

  if (isPlatformUser) return <AdminDashboard />

  const isManager    = effectiveRole === 'tenant_manager' || effectiveRole === 'dept_lead'
  const isTenantUser = effectiveRole === 'tenant_user'
  const displayCurrency = tenantContext?.display_currency || 'INR'
  const balance         = wallet?.data?.balance || 0
  const expiryPolicy    = tenantContext?.expiry_policy
  const showExpiryNudge = isTenantUser && expiryPolicy && expiryPolicy !== 'never' && parseFloat(balance) > 0

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Morning Briefing — managers only */}
      {isManager && <MorningBriefing />}

      {/* ── Tenant user: hero card ─────────────────────────────────────────── */}
      {isTenantUser && (
        <div className="bg-gradient-to-br from-sparknode-purple via-indigo-700 to-sparknode-blue rounded-2xl p-5 sm:p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
            {/* Avatar + name */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-xl sm:text-2xl font-bold flex-shrink-0">
                {getInitials(user)}
              </div>
              <div className="min-w-0">
                <p className="text-white/60 text-xs font-medium uppercase tracking-widest">Welcome back</p>
                <h1 className="text-xl sm:text-2xl font-bold truncate">{getFirstName(user)} 👋</h1>
                {stats?.data?.top_badges?.[0] && (
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-medium">
                    ⭐ {stats.data.top_badges[0].name}
                  </span>
                )}
              </div>
            </div>

            {/* Points balance panel */}
            <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-4 text-center sm:text-right flex-shrink-0 backdrop-blur-sm">
              <p className="text-white/60 text-xs font-medium uppercase tracking-widest">Points Balance</p>
              <p className="text-3xl sm:text-4xl font-extrabold mt-1 tabular-nums">
                {formatPoints(balance, displayCurrency)}
              </p>
              <p className="text-white/40 text-xs mt-1">
                Lifetime: {formatPoints(wallet?.data?.lifetime_earned || 0, displayCurrency)}
              </p>
            </div>
          </div>

          {/* Quick action row */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { label: 'Recognize',     icon: <HiOutlineStar className="w-5 h-5" />,  action: () => setShowRecognitionModal(true) },
              { label: 'Redeem Points', icon: <HiOutlineGift className="w-5 h-5" />,  action: () => navigate('/redeem') },
              { label: 'View Feed',     icon: <HiNewspaper   className="w-5 h-5" />,  action: () => navigate('/feed') },
            ].map(({ label, icon, action }) => (
              <button
                key={label}
                onClick={action}
                className="flex flex-col items-center gap-2 py-3 sm:py-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-colors group"
              >
                <span className="group-hover:scale-110 transition-transform">{icon}</span>
                <span className="text-xs font-medium leading-tight text-center px-1">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fallback welcome banner (non-manager, non-tenant-user edge case) */}
      {!isTenantUser && !isManager && (
        <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-xl p-4 sm:p-5 text-white">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-0.5">Welcome back, {user?.first_name}! 👋</h1>
          <p className="text-xs sm:text-sm text-white/80">Ready to recognize your colleagues today?</p>
        </div>
      )}

      {/* ── Points expiry nudge ────────────────────────────────────────────── */}
      {showExpiryNudge && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <HiOutlineClock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              Your points expire after {EXPIRY_LABELS[expiryPolicy] || 'a set period'}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              You have {formatPoints(balance, displayCurrency)} — redeem before they're gone.
            </p>
          </div>
          <button
            onClick={() => navigate('/redeem')}
            className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors whitespace-nowrap"
          >
            Redeem now <HiOutlineArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Stats grid ────────────────────────────────────────────────────── */}
      {isTenantUser ? (
        /* Differentiated colour cards for employees */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatMini
            label="Recognitions Given"
            value={stats?.data?.total_given || 0}
            sub={`${stats?.data?.points_given || 0} pts sent to colleagues`}
            colour="blue"
            icon={<HiOutlineSparkles className="w-4 h-4" />}
          />
          <StatMini
            label="Recognitions Received"
            value={stats?.data?.total_received || 0}
            sub={`${stats?.data?.points_received || 0} pts earned`}
            colour="purple"
            icon={<HiOutlineTrendingUp className="w-4 h-4" />}
          />
          <StatMini
            label="Top Badge"
            value={stats?.data?.top_badges?.[0]?.name || '—'}
            sub={stats?.data?.top_badges?.[0] ? `${stats.data.top_badges[0].count}× earned` : 'Keep recognizing!'}
            colour="amber"
            icon="🏆"
          />
        </div>
      ) : (
        /* Standard purple grid for managers */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <WalletBalance wallet={wallet?.data} />

          <div className="stat-card stat-card-compact bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-white/80">Recognitions Given</p>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1">{stats?.data?.total_given || 0}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <HiOutlineSparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div className="stat-compact-footer">
              <span className="text-white/80">{stats?.data?.points_given || 0} points</span>
            </div>
          </div>

          <div className="stat-card stat-card-compact bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-white/80">Recognitions Received</p>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1">{stats?.data?.total_received || 0}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <HiOutlineTrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div className="stat-compact-footer">
              <span className="text-white/80">{stats?.data?.points_received || 0} points</span>
            </div>
          </div>

          <div className="stat-card stat-card-compact bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-white/80">Top Badge</p>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1">
                  {stats?.data?.top_badges?.[0]?.name || 'None yet'}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <HiOutlineGift className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div className="stat-compact-footer">
              <span className="text-white/80">{stats?.data?.top_badges?.[0]?.count || 0} times received</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent activity ───────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Recent Activity</h2>
          {feed?.data?.length > 0 && (
            <button
              onClick={() => navigate('/feed')}
              className="flex items-center gap-1 text-xs font-medium text-sparknode-purple hover:underline"
            >
              View all <HiOutlineArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {feed?.data?.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {feed.data.map((item) => (
              <FeedCard key={item.id} item={item} compact />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 sm:py-10">
            <div className="text-5xl mb-4">🤝</div>
            <p className="text-sm font-semibold text-gray-700">No activity yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-5">Be the first to recognize a teammate!</p>
            <button onClick={() => setShowRecognitionModal(true)} className="btn-primary text-sm">
              Send First Recognition
            </button>
          </div>
        )}
      </div>

      {/* Recognition modal — triggered from hero quick action */}
      <RecognitionModal
        isOpen={showRecognitionModal}
        onClose={() => setShowRecognitionModal(false)}
      />
    </div>
  )
}
