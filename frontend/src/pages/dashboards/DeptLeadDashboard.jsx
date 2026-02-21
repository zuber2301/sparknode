import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { deptDashboardApi } from '../../lib/api'
import { formatDisplayValue } from '../../lib/currency'
import { formatDistanceToNow } from 'date-fns'
import {
  HiOutlineWallet,
  HiOutlineUsers,
  HiOutlineArrowTrendingUp,
  HiOutlineBanknotes,
  HiOutlineSparkles,
  HiOutlineTrophy,
  HiOutlineChartBar,
} from 'react-icons/hi2'

/**
 * Department Lead Dashboard
 *
 * Shows department-scoped metrics only — no master pool (that belongs to Tenant Manager).
 *
 * Tabs:
 *  Overview  — budget hero cards, top receivers, quick stats sidebar, quick actions
 *  Team      — full member list with wallet balances + recognition stats
 *  Activity  — recent recognition feed within the department
 */

// ── Reusable sub-components ───────────────────────────────────────────────────

function BudgetHeroCard({ title, value, currency, description, icon: Icon, colorClass, bgClass }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-bold text-gray-500 tracking-wider mb-1 uppercase">{title}</p>
          <h3 className="text-3xl font-black text-gray-900">{formatDisplayValue(value, currency)}</h3>
        </div>
        <div className={`p-3 rounded-xl ${bgClass}`}>
          <Icon className={`w-6 h-6 ${colorClass}`} />
        </div>
      </div>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  )
}

function UtilizationBar({ pct, consumed, allocated, currency }) {
  const safePct = Math.min(100, Math.max(0, pct || 0))
  const barColor =
    safePct >= 90 ? 'bg-red-500' : safePct >= 70 ? 'bg-amber-500' : 'bg-sparknode-purple'
  const textColor =
    safePct >= 90 ? 'text-red-600' : safePct >= 70 ? 'text-amber-600' : 'text-sparknode-purple'

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-gray-700">Budget Utilization</h4>
        <span className={`text-sm font-black ${textColor}`}>{safePct}%</span>
      </div>
      <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${safePct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{formatDisplayValue(consumed, currency)} distributed to team</span>
        <span>of {formatDisplayValue(allocated, currency)} allocated by manager</span>
      </div>
    </div>
  )
}

function TopReceiversCard({ consumers, currency }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50 flex items-center gap-2">
        <HiOutlineTrophy className="w-5 h-5 text-amber-500" />
        <h3 className="text-base font-bold text-gray-900">Top Receivers</h3>
        <span className="ml-auto text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          By points received
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {consumers.length > 0 ? (
          consumers.map((c, idx) => (
            <div key={c.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition">
              <span
                className={`text-xl font-black w-7 text-center ${
                  idx === 0
                    ? 'text-amber-500'
                    : idx === 1
                    ? 'text-slate-400'
                    : idx === 2
                    ? 'text-orange-400'
                    : 'text-gray-300'
                }`}
              >
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                <p className="text-xs text-gray-400">{c.recognitions_received} recognitions received</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-black text-sparknode-purple">
                  {formatDisplayValue(c.points_received, currency)}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">pts</p>
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            No recognition data yet — start recognizing your team!
          </div>
        )}
      </div>
    </div>
  )
}

function MembersTable({ members, currency }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiOutlineUsers className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-900">Team Members</h3>
        </div>
        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
          {members.length} active
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/50">
              <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Name
              </th>
              <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Wallet Balance
              </th>
              <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Lifetime Earned
              </th>
              <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Pts Received
              </th>
              <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Recognitions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {members.length > 0 ? (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-6 py-3.5">
                    <div>
                      <p className="font-semibold text-gray-900">{m.name}</p>
                      <p className="text-[11px] text-gray-400">{m.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right font-black text-sparknode-purple">
                    {formatDisplayValue(m.wallet_balance, currency)}
                  </td>
                  <td className="px-6 py-3.5 text-right text-gray-500 font-semibold">
                    {formatDisplayValue(m.lifetime_earned, currency)}
                  </td>
                  <td className="px-6 py-3.5 text-right text-gray-700 font-semibold">
                    {formatDisplayValue(m.points_received, currency)}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      <HiOutlineSparkles className="w-3 h-3" />
                      {m.recognitions_received}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                  No members in this department yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ActivityFeed({ recognitions, onRefresh }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiOutlineSparkles className="w-5 h-5 text-sparknode-purple" />
          <h3 className="text-base font-bold text-gray-900">Recognition Activity</h3>
        </div>
        <button
          onClick={onRefresh}
          className="text-[10px] font-bold text-sparknode-purple uppercase tracking-widest hover:underline"
        >
          Refresh
        </button>
      </div>
      <div className="divide-y divide-gray-50">
        {recognitions.length > 0 ? (
          recognitions.map((item) => (
            <div key={item.id} className="px-6 py-4 hover:bg-gray-50/50 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900 mb-1">
                    {item.from_user}{' '}
                    <span className="text-gray-400 font-medium">recognized</span>{' '}
                    {item.to_user}
                  </p>
                  {item.message && (
                    <p className="text-xs text-gray-500 leading-relaxed italic">
                      "{item.message}"
                    </p>
                  )}
                </div>
                <div className="text-right flex flex-col items-end flex-shrink-0">
                  <span className="text-sm font-black text-sparknode-purple mb-1">
                    +{item.points} pts
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-12 text-center text-gray-400">
            No recognition activity yet — be the first to recognize a teammate!
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DeptLeadDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const { user } = useAuthStore()

  const { data: summaryResponse, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['deptDashboardSummary'],
    queryFn: () => deptDashboardApi.getDeptSummary(),
    refetchInterval: 60000,
  })

  const d = summaryResponse?.data
  const dept = d?.department
  const currency = d?.currency || 'INR'
  const members = d?.members?.list || []
  const topConsumers = d?.top_consumers || []
  const recentRecs = d?.recent_recognitions || []

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'team', label: `Team (${d?.members?.total ?? '\u2014'})` },
    { id: 'activity', label: 'Activity' },
  ]

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin mb-4">
            <HiOutlineArrowTrendingUp className="w-12 h-12 text-sparknode-purple" />
          </div>
          <p className="text-gray-700 font-medium tracking-tight">
            Loading your department dashboard...
          </p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
          <p className="font-semibold mb-2 text-lg">Error Loading Dashboard</p>
          <p className="text-sm">{error?.message || 'Could not fetch department data'}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-6 py-2 bg-sparknode-purple text-white rounded-xl hover:bg-sparknode-purple/90 transition shadow-sm text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-bold text-sparknode-purple uppercase tracking-widest mb-1">
            Department Lead
          </p>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            {dept?.name || 'My Department'}
          </h1>
          <p className="text-gray-500 mt-1 font-medium italic">
            Welcome back, Department Lead — here's your department at a glance
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
        >
          <HiOutlineArrowTrendingUp
            className={`w-4 h-4 text-sparknode-purple ${isFetching ? 'animate-spin' : ''}`}
          />
          {isFetching ? 'Syncing...' : 'Sync Data'}
        </button>
      </div>

      {/* ── Budget Hero Cards ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <BudgetHeroCard
          title="DEPT POOL"
          value={dept?.budget_pool || 0}
          currency={currency}
          description="Available for you to distribute to team members"
          icon={HiOutlineBanknotes}
          colorClass="text-sparknode-purple"
          bgClass="bg-purple-50"
        />
        <BudgetHeroCard
          title="IN TEAM WALLETS"
          value={dept?.total_in_wallets || 0}
          currency={currency}
          description="Points currently held by team members"
          icon={HiOutlineWallet}
          colorClass="text-green-600"
          bgClass="bg-green-50"
        />
        <BudgetHeroCard
          title="DISTRIBUTED TO TEAM"
          value={dept?.budget_consumed || 0}
          currency={currency}
          description="Total points sent to your team this cycle"
          icon={HiOutlineChartBar}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
        />
      </div>

      {/* ── Utilization Bar ──────────────────────────────── */}
      <div className="mb-8">
        <UtilizationBar
          pct={dept?.utilization_pct || 0}
          consumed={dept?.budget_consumed || 0}
          allocated={dept?.budget_allocated || 0}
          currency={currency}
        />
      </div>

      {/* ── Tabs ────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-sparknode-purple text-sparknode-purple'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ───────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left — top receivers + recent activity preview */}
          <div className="lg:col-span-2 space-y-8">
            <TopReceiversCard consumers={topConsumers} currency={currency} />
            <ActivityFeed recognitions={recentRecs.slice(0, 5)} onRefresh={refetch} />
          </div>

          {/* Right — stats card + quick actions */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gradient-to-br from-sparknode-purple to-sparknode-blue rounded-2xl p-6 text-white shadow-lg">
              <h4 className="text-sm font-bold mb-6 opacity-90">Department Stats</h4>
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">
                    Team Size
                  </p>
                  <p className="text-2xl font-black">
                    {d?.members?.total || 0}{' '}
                    <span className="text-sm font-medium opacity-70">members</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">
                    Pool Remaining
                  </p>
                  <p className="text-2xl font-black">
                    {formatDisplayValue(dept?.budget_pool || 0, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">
                    Recent Recognitions
                  </p>
                  <p className="text-2xl font-black">{recentRecs.length}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-white/70 uppercase tracking-widest mb-2">
                    <span>Budget Used</span>
                    <span>{dept?.utilization_pct || 0}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all"
                      style={{ width: `${Math.min(100, dept?.utilization_pct || 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <a
                  href="/team-distribute"
                  className="flex items-center gap-3 w-full px-4 py-3 bg-sparknode-purple text-white rounded-xl hover:bg-sparknode-purple/90 transition text-sm font-semibold"
                >
                  <HiOutlineBanknotes className="w-5 h-5" />
                  Distribute Points to Team
                </a>
                <button
                  onClick={() => setActiveTab('team')}
                  className="flex items-center gap-3 w-full px-4 py-3 bg-sparknode-purple/10 text-sparknode-purple rounded-xl hover:bg-sparknode-purple/20 transition text-sm font-semibold"
                >
                  <HiOutlineUsers className="w-5 h-5" />
                  View All Members
                </button>
                <button
                  onClick={() => setActiveTab('activity')}
                  className="flex items-center gap-3 w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition text-sm font-semibold"
                >
                  <HiOutlineSparkles className="w-5 h-5" />
                  View Recognition Feed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Team ────────────────────────────────────── */}
      {activeTab === 'team' && <MembersTable members={members} currency={currency} />}

      {/* ── Tab: Activity ────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className="max-w-4xl mx-auto">
          <ActivityFeed recognitions={recentRecs} onRefresh={refetch} />
        </div>
      )}
    </div>
  )
}
