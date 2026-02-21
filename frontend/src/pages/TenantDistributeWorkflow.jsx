import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { tmDistributeApi } from '../lib/api'
import { formatDisplayValue } from '../lib/currency'
import toast from 'react-hot-toast'
import {
  HiOutlineBuildingOffice2,
  HiOutlineUsers,
  HiOutlineBanknotes,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineArrowTrendingUp,
  HiOutlineSparkles,
  HiOutlineCursorArrowRipple,
  HiOutlineChartBar,
} from 'react-icons/hi2'

// ── Reusable sub-components ───────────────────────────────────────────────────

function PoolBadge({ balance, currency }) {
  const low = balance < 1000
  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
        low
          ? 'bg-red-50 text-red-700 border border-red-200'
          : 'bg-purple-50 text-sparknode-purple border border-purple-200'
      }`}
    >
      <HiOutlineBanknotes className="w-4 h-4" />
      Pool: {formatDisplayValue(balance, currency)}
    </div>
  )
}

function ConfirmationModal({ isOpen, onClose, onConfirm, title, subtitle, summary, isLoading }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-sparknode-purple to-sparknode-blue px-6 pt-6 pb-8">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
            <HiOutlineBanknotes className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-black text-white">{title}</h3>
          {subtitle && <p className="text-white/70 text-sm mt-1">{subtitle}</p>}
        </div>

        {/* Summary card — overlaps header */}
        <div className="mx-5 -mt-4 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-5">
          {summary.map((row, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-4 py-3 ${
                i < summary.length - 1 ? 'border-b border-gray-50' : ''
              } ${row.highlight ? 'bg-sparknode-purple/5' : ''}`}
            >
              <span className="text-xs font-semibold text-gray-500">{row.label}</span>
              <span className={`text-sm font-black ${
                row.highlight ? 'text-sparknode-purple' : 'text-gray-900'
              }`}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Warning note */}
        <div className="mx-5 mb-5 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <HiOutlineExclamationTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-medium">This action cannot be undone. Points will be deducted from the company pool immediately.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl bg-sparknode-purple text-white text-sm font-bold hover:bg-sparknode-purple/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <HiOutlineArrowTrendingUp className="w-4 h-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <HiOutlineCheckCircle className="w-4 h-4" />
                Confirm & Distribute
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function SuccessResult({ result, onReset }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-5 rounded-full bg-green-50 mb-5">
        <HiOutlineCheckCircle className="w-14 h-14 text-green-500" />
      </div>
      <h3 className="text-2xl font-black text-gray-900 mb-3">Distribution Complete!</h3>
      <p className="text-gray-500 mb-6 max-w-sm">{result.message}</p>
      <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-sm">
        {'department_name' in result && (
          <div className="col-span-2 bg-blue-50 rounded-xl p-4">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Department</p>
            <p className="text-lg font-black text-blue-800">{result.department_name}</p>
          </div>
        )}
        {'users_credited' in result && (
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1">Users Credited</p>
            <p className="text-2xl font-black text-green-700">{result.users_credited}</p>
          </div>
        )}
        {'user_count' in result && (
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1">Users</p>
            <p className="text-2xl font-black text-green-700">{result.user_count}</p>
          </div>
        )}
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">Per User</p>
          <p className="text-lg font-black text-sparknode-purple">{Number(result.points_per_user).toLocaleString()} pts</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 col-span-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pool Remaining</p>
          <p className="text-lg font-black text-gray-800">{Number(result.tenant_pool_remaining).toLocaleString()} pts</p>
        </div>
      </div>
      <button
        onClick={onReset}
        className="px-8 py-3 bg-sparknode-purple text-white rounded-xl font-bold hover:bg-sparknode-purple/90 transition"
      >
        Make Another Distribution
      </button>
    </div>
  )
}

// ── Department Distribution Tab ───────────────────────────────────────────────

function DeptDistributionTab({ currency }) {
  const [selectedDept, setSelectedDept] = useState(null)
  const [pointsPerUser, setPointsPerUser] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const qc = useQueryClient()

  const { data: previewRes, isLoading } = useQuery({
    queryKey: ['tmDeptPreview'],
    queryFn: () => tmDistributeApi.getDeptPreview(),
    refetchOnWindowFocus: false,
  })

  const departments = previewRes?.data?.departments || []
  const poolBalance = Number(previewRes?.data?.tenant_pool_balance || 0)

  const ppu = parseFloat(pointsPerUser) || 0
  const userCount = selectedDept?.active_user_count || 0
  const totalPoints = ppu * userCount
  const hasEnoughPool = totalPoints > 0 && poolBalance >= totalPoints
  const canSubmit = selectedDept && ppu > 0 && userCount > 0 && hasEnoughPool

  const mutation = useMutation({
    mutationFn: (data) => tmDistributeApi.distributeToDeptPerUser(data),
    onSuccess: () => {
      setShowConfirm(false)
      setSelectedDept(null)
      setPointsPerUser('')
      toast.success('Distribution complete!')
      qc.invalidateQueries(['tmDeptPreview'])
      qc.invalidateQueries(['deptDashboardSummary'])
    },
    onError: (e) => {
      setShowConfirm(false)
      toast.error(e?.response?.data?.detail || 'Distribution failed')
    },
  })

  const handleConfirm = () => {
    mutation.mutate({
      department_id: selectedDept.id,
      points_per_user: ppu,
      description: `Per-user distribution: ${ppu} pts × ${userCount} users`,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <HiOutlineArrowTrendingUp className="w-8 h-8 text-sparknode-purple animate-spin" />
      </div>
    )
  }

  return (
    <>
    <div className="flex gap-6 min-h-[460px]">

      {/* ── Left: compact department list ─────────────────── */}
      <div className="w-64 flex-shrink-0">
        <p className="text-sm font-bold text-gray-700 mb-3">
          Departments
        </p>
        {departments.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No departments found</p>
        ) : (
          <div className="space-y-2.5">
            {departments.map((dept, idx) => {
              const isSelected = selectedDept?.id === dept.id
              const gradients = [
                ['from-violet-500 to-indigo-600', 'bg-violet-500'],
                ['from-blue-500 to-cyan-600', 'bg-blue-500'],
                ['from-emerald-500 to-teal-600', 'bg-emerald-500'],
                ['from-amber-500 to-orange-500', 'bg-amber-500'],
                ['from-pink-500 to-rose-600', 'bg-pink-500'],
                ['from-indigo-500 to-blue-700', 'bg-indigo-500'],
              ]
              const [gradient, dotColor] = gradients[idx % gradients.length]
              const initials = dept.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              return (
                <button
                  key={dept.id}
                  onClick={() => { setSelectedDept(isSelected ? null : dept); setPointsPerUser('') }}
                  className={`w-full text-left rounded-2xl overflow-hidden transition-all duration-200 ${
                    isSelected
                      ? 'ring-2 ring-offset-2 ring-sparknode-purple shadow-lg scale-[1.02]'
                      : 'hover:shadow-lg hover:scale-[1.01] shadow-sm'
                  }`}
                >
                  {/* Gradient header */}
                  <div className={`bg-gradient-to-br ${gradient} px-3 py-3`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-black text-xs">{initials}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-bold text-sm leading-tight truncate">{dept.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <HiOutlineUsers className="w-3 h-3 text-white/70" />
                          <span className="text-white/80 text-xs">{dept.active_user_count} active users</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                          <HiOutlineCheckCircle className="w-4 h-4 text-sparknode-purple" />
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Balance footer */}
                  <div className="bg-white px-4 py-2.5 flex items-center justify-between border border-t-0 border-gray-100 rounded-b-2xl">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Balance</p>
                    <p className="text-sm font-black text-gray-800">{formatDisplayValue(dept.current_balance, currency)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Divider ────────────────────────────────────────── */}
      <div className="w-px bg-gray-100 self-stretch flex-shrink-0" />

      {/* ── Right: form + preview ──────────────────────────── */}
      <div className="flex-1 min-w-0">
        {!selectedDept ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <HiOutlineBuildingOffice2 className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-gray-400 font-semibold text-sm">Select a department</p>
            <p className="text-gray-300 text-xs mt-1">Choose from the list on the left</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selected dept banner */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white ${
                ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-amber-500','bg-pink-500','bg-indigo-500'][
                  departments.findIndex(d => d.id === selectedDept.id) % 6
                ]
              }`}>
                {selectedDept.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div>
                <p className="font-black text-gray-900 text-sm">{selectedDept.name}</p>
                <p className="text-xs text-gray-400">{selectedDept.active_user_count} active employees · Balance: {formatDisplayValue(selectedDept.current_balance, currency)}</p>
              </div>
            </div>

            {/* Points input */}
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                Points per employee
              </label>
              <div className="relative max-w-xs">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={pointsPerUser}
                  onChange={(e) => setPointsPerUser(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-4 py-3 pr-14 rounded-xl border border-gray-200 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sparknode-purple/30 focus:border-sparknode-purple transition text-lg"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 uppercase">pts</span>
              </div>
            </div>

            {/* Live preview */}
            {ppu > 0 && (
              <div className={`rounded-2xl p-5 border-2 ${hasEnoughPool ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200' : 'bg-red-50 border-red-200'}`}>
                {/* Equation */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="px-3 py-1.5 bg-white rounded-lg text-sm font-bold text-gray-700 shadow-sm">
                    {ppu.toLocaleString()} pts/user
                  </span>
                  <span className="text-gray-400 font-black text-lg">×</span>
                  <span className="px-3 py-1.5 bg-white rounded-lg text-sm font-bold text-gray-700 shadow-sm">
                    {userCount} users
                  </span>
                  <span className="text-gray-400 font-black text-lg">=</span>
                  <span className={`px-3 py-1.5 rounded-lg text-sm font-black shadow-sm ${hasEnoughPool ? 'bg-sparknode-purple text-white' : 'bg-red-500 text-white'}`}>
                    {totalPoints.toLocaleString()} pts total
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Per User</p>
                    <p className="text-base font-black text-sparknode-purple">{ppu.toLocaleString()} pts</p>
                  </div>
                  <div className="bg-white rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Total</p>
                    <p className={`text-base font-black ${hasEnoughPool ? 'text-gray-900' : 'text-red-600'}`}>{totalPoints.toLocaleString()} pts</p>
                  </div>
                  <div className="bg-white rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Pool After</p>
                    <p className="text-base font-black text-gray-700">{(poolBalance - totalPoints).toLocaleString()}</p>
                  </div>
                </div>

                {!hasEnoughPool && (
                  <div className="flex items-center gap-2 text-red-700 bg-red-100 rounded-xl px-4 py-3 mb-4">
                    <HiOutlineExclamationTriangle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-xs font-semibold">
                      Need {totalPoints.toLocaleString()} pts — pool only has {poolBalance.toLocaleString()} pts.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={!canSubmit}
                  className="w-full py-3 rounded-xl bg-sparknode-purple text-white font-bold text-sm hover:bg-sparknode-purple/90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <HiOutlineBanknotes className="w-5 h-5" />
                  Distribute to {selectedDept.name}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    <ConfirmationModal
      isOpen={showConfirm}
      onClose={() => setShowConfirm(false)}
      onConfirm={handleConfirm}
      isLoading={mutation.isPending}
      title="Confirm Distribution"
      subtitle={`Allocating points to ${selectedDept?.name}`}
      summary={[
        { label: 'Department', value: selectedDept?.name },
        { label: 'Active employees', value: `${userCount} users` },
        { label: 'Points per employee', value: `${ppu.toLocaleString()} pts`, highlight: true },
        { label: 'Total to allocate', value: `${totalPoints.toLocaleString()} pts`, highlight: true },
        { label: 'Pool balance after', value: `${(poolBalance - totalPoints).toLocaleString()} pts` },
      ]}
    />
  </>
  )
}

// ── All Users Distribution Tab ────────────────────────────────────────────────

function AllUsersDistributionTab({ currency }) {
  const [pointsPerUser, setPointsPerUser] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const qc = useQueryClient()

  const { data: previewRes, isLoading } = useQuery({
    queryKey: ['tmAllUsersPreview'],
    queryFn: () => tmDistributeApi.getAllUsersPreview(),
    refetchOnWindowFocus: false,
  })

  const totalUsers = previewRes?.data?.active_user_count || 0
  const poolBalance = Number(previewRes?.data?.tenant_pool_balance || 0)

  const ppu = parseFloat(pointsPerUser) || 0
  const totalPoints = ppu * totalUsers
  const hasEnoughPool = totalPoints > 0 && poolBalance >= totalPoints
  const canSubmit = ppu > 0 && totalUsers > 0 && hasEnoughPool

  const mutation = useMutation({
    mutationFn: (data) => tmDistributeApi.distributeToAllUsers(data),
    onSuccess: () => {
      setShowConfirm(false)
      setPointsPerUser('')
      toast.success('Distributed to all users!')
      qc.invalidateQueries(['tmAllUsersPreview'])
    },
    onError: (e) => {
      setShowConfirm(false)
      toast.error(e?.response?.data?.detail || 'Distribution failed')
    },
  })

  const handleConfirm = () => {
    mutation.mutate({
      points_per_user: ppu,
      description: `Tenant-wide distribution: ${ppu} pts/user`,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <HiOutlineArrowTrendingUp className="w-8 h-8 text-sparknode-purple animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Info banner */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200 flex items-center gap-5">
        <div className="p-4 bg-blue-100 rounded-2xl flex-shrink-0">
          <HiOutlineUsers className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">
            Tenant-Wide Distribution
          </p>
          <p className="text-2xl font-black text-gray-900">
            {totalUsers}{' '}
            <span className="text-base font-medium text-gray-500">active employees</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Points will be credited directly to each employee's wallet
          </p>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <HiOutlineExclamationTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 font-medium">
          This distributes directly to employee wallets, not department pools. Points will be
          immediately spendable by all users.
        </p>
      </div>

      {/* Points input */}
      <div>
        <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">
          Set Points Per Employee
        </h3>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm max-w-lg">
          <label className="block text-sm font-bold text-gray-700 mb-2">Points per user</label>
          <div className="relative">
            <input
              type="number"
              min="1"
              step="1"
              value={pointsPerUser}
              onChange={(e) => setPointsPerUser(e.target.value)}
              placeholder="e.g. 200"
              className="w-full px-4 py-3 pr-16 rounded-xl border border-gray-200 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sparknode-purple/30 focus:border-sparknode-purple transition"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 uppercase">
              pts
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Every active employee in the tenant will receive this many points
          </p>
        </div>
      </div>

      {/* Live preview */}
      {ppu > 0 && (
        <div>
          <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">
            Preview & Confirm
          </h3>
          <div
            className={`rounded-2xl p-6 border-2 ${
              hasEnoughPool
                ? 'bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                  All Active Users
                </p>
                <p className="text-2xl font-black text-gray-900">{totalUsers}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Per User
                </p>
                <p className="text-2xl font-black text-sparknode-purple">
                  {ppu.toLocaleString()} pts
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Total Cost
                </p>
                <p
                  className={`text-2xl font-black ${
                    hasEnoughPool ? 'text-gray-900' : 'text-red-600'
                  }`}
                >
                  {totalPoints.toLocaleString()} pts
                </p>
              </div>
            </div>

            {/* Equation display */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <span className="px-3 py-1.5 bg-white rounded-lg text-sm font-bold text-gray-700 shadow-sm">
                {ppu.toLocaleString()} pts/user
              </span>
              <span className="text-gray-400 font-black">×</span>
              <span className="px-3 py-1.5 bg-white rounded-lg text-sm font-bold text-gray-700 shadow-sm">
                {totalUsers} users
              </span>
              <span className="text-gray-400 font-black">=</span>
              <span
                className={`px-3 py-1.5 rounded-lg text-sm font-black shadow-sm ${
                  hasEnoughPool ? 'bg-sparknode-purple text-white' : 'bg-red-500 text-white'
                }`}
              >
                {totalPoints.toLocaleString()} pts total
              </span>
            </div>

            {!hasEnoughPool && (
              <div className="flex items-center gap-2 text-red-700 bg-red-100 rounded-xl px-4 py-3 mb-5">
                <HiOutlineExclamationTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-semibold">
                  Insufficient pool balance. Need {totalPoints.toLocaleString()} pts, available{' '}
                  {poolBalance.toLocaleString()} pts.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-200/50 mb-5">
              <span>
                Current pool: <strong>{poolBalance.toLocaleString()} pts</strong>
              </span>
              <span>
                Pool after:{' '}
                <strong>{Math.max(0, poolBalance - totalPoints).toLocaleString()} pts</strong>
              </span>
            </div>

            <button
              onClick={() => setShowConfirm(true)}
              disabled={!canSubmit}
              className="w-full py-3 rounded-xl bg-sparknode-purple text-white font-bold text-sm hover:bg-sparknode-purple/90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <HiOutlineSparkles className="w-5 h-5" />
              Distribute to All {totalUsers} Users
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        isLoading={mutation.isPending}
        title="Confirm Distribution"
        subtitle="Crediting points to all active employees"
        summary={[
          { label: 'Recipients', value: `${totalUsers} active users` },
          { label: 'Points per employee', value: `${ppu.toLocaleString()} pts`, highlight: true },
          { label: 'Total deducted from pool', value: `${totalPoints.toLocaleString()} pts`, highlight: true },
          { label: 'Pool balance after', value: `${Math.max(0, poolBalance - totalPoints).toLocaleString()} pts` },
        ]}
      />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TenantDistributeWorkflow() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('dept')

  // Role guard
  if (user?.org_role !== 'tenant_manager' && user?.org_role !== 'platform_admin') {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <HiOutlineExclamationTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-black text-red-700 mb-2">Access Denied</h3>
          <p className="text-sm text-red-600">
            Budget distribution is only accessible to Tenant Managers.
          </p>
        </div>
      </div>
    )
  }

  // We derive currency from previews — default INR
  const currency = 'INR'

  const TABS = [
    {
      id: 'dept',
      label: 'Distribute to Department',
      icon: HiOutlineBuildingOffice2,
      desc: 'Allocate based on employees per dept',
    },
    {
      id: 'all',
      label: 'Distribute to All Users',
      icon: HiOutlineCursorArrowRipple,
      desc: 'Credit points to every employee',
    },
  ]

  return (
    <div className="min-h-screen bg-transparent">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="text-xs font-bold text-sparknode-purple uppercase tracking-widest mb-1">
            Tenant Manager
          </p>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Budget Distribution</h1>
          <p className="text-gray-500 mt-1 font-medium">
            Allocate points from your company pool to departments or all employees
          </p>
        </div>
        <PoolBudgetBadge currency={currency} />
      </div>

      {/* ── Tab selector ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition hover:shadow-md ${
                active
                  ? 'border-sparknode-purple bg-purple-50 shadow-md'
                  : 'border-gray-100 bg-white hover:border-purple-200'
              }`}
            >
              <div className={`p-3 rounded-xl ${active ? 'bg-sparknode-purple' : 'bg-gray-100'}`}>
                <Icon className={`w-6 h-6 ${active ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <div>
                <p
                  className={`text-sm font-black ${
                    active ? 'text-sparknode-purple' : 'text-gray-900'
                  }`}
                >
                  {tab.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{tab.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        {activeTab === 'dept' && <DeptDistributionTab currency={currency} />}
        {activeTab === 'all' && <AllUsersDistributionTab currency={currency} />}
      </div>
    </div>
  )
}

// Pool badge that fetches its own data so it stays in sync
function PoolBudgetBadge({ currency }) {
  const { data: deptPrev } = useQuery({
    queryKey: ['tmDeptPreview'],
    queryFn: () => tmDistributeApi.getDeptPreview(),
    refetchOnWindowFocus: false,
  })
  const balance = Number(deptPrev?.data?.tenant_pool_balance || 0)
  return <PoolBadge balance={balance} currency={currency} />
}
