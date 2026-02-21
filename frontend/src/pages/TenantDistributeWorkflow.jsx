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

function ConfirmationModal({ isOpen, onClose, onConfirm, title, lines, isLoading }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-amber-50">
            <HiOutlineExclamationTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <h3 className="text-lg font-black text-gray-900">{title}</h3>
        </div>
        <div className="space-y-2 mb-6">
          {lines.map((l, i) => (
            <p key={i} className="text-sm text-gray-700">
              {l}
            </p>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl bg-sparknode-purple text-white text-sm font-bold hover:bg-sparknode-purple/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <HiOutlineArrowTrendingUp className="w-4 h-4 animate-spin" />
                Processing…
              </>
            ) : (
              'Confirm & Distribute'
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
  const [successResult, setSuccessResult] = useState(null)
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
    onSuccess: (res) => {
      setShowConfirm(false)
      setSuccessResult(res.data)
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

  const handleReset = () => {
    setSuccessResult(null)
    setSelectedDept(null)
    setPointsPerUser('')
  }

  if (successResult) return <SuccessResult result={successResult} onReset={handleReset} />

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <HiOutlineArrowTrendingUp className="w-8 h-8 text-sparknode-purple animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Dept selection */}
      <div>
        <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">
          1. Select Department
        </h3>
        {departments.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No departments found</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => {
              const isSelected = selectedDept?.id === dept.id
              return (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDept(isSelected ? null : dept)}
                  className={`text-left p-5 rounded-2xl border-2 transition hover:shadow-md ${
                    isSelected
                      ? 'border-sparknode-purple bg-purple-50 shadow-md'
                      : 'border-gray-100 bg-white hover:border-purple-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`p-2 rounded-xl ${isSelected ? 'bg-sparknode-purple' : 'bg-gray-100'}`}
                    >
                      <HiOutlineBuildingOffice2
                        className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-500'}`}
                      />
                    </div>
                    {isSelected && (
                      <HiOutlineCheckCircle className="w-5 h-5 text-sparknode-purple" />
                    )}
                  </div>
                  <p
                    className={`text-sm font-black mb-1 ${
                      isSelected ? 'text-sparknode-purple' : 'text-gray-900'
                    }`}
                  >
                    {dept.name}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <HiOutlineUsers className="w-3.5 h-3.5" />
                      {dept.active_user_count} active users
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold mb-0.5">
                      Current Balance
                    </p>
                    <p className="text-sm font-black text-gray-700">
                      {formatDisplayValue(dept.current_balance, currency)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Points input */}
      <div>
        <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">
          2. Set Points Per Employee
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
              placeholder="e.g. 500"
              className="w-full px-4 py-3 pr-16 rounded-xl border border-gray-200 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sparknode-purple/30 focus:border-sparknode-purple transition"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 uppercase">
              pts
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Each active employee in the selected department will receive this many points
          </p>
        </div>
      </div>

      {/* Live preview panel */}
      {selectedDept && ppu > 0 && (
        <div>
          <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">
            3. Preview & Confirm
          </h3>
          <div
            className={`rounded-2xl p-6 border-2 ${
              hasEnoughPool
                ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Department
                </p>
                <p className="text-base font-black text-gray-900 truncate">{selectedDept.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Active Users
                </p>
                <p className="text-base font-black text-gray-900">{userCount}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Per User
                </p>
                <p className="text-base font-black text-sparknode-purple">
                  {ppu.toLocaleString()} pts
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Total to Allocate
                </p>
                <p
                  className={`text-base font-black ${
                    hasEnoughPool ? 'text-gray-900' : 'text-red-600'
                  }`}
                >
                  {totalPoints.toLocaleString()} pts
                </p>
              </div>
            </div>

            {/* Calculation display */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <span className="px-3 py-1.5 bg-white rounded-lg text-sm font-bold text-gray-700 shadow-sm">
                {ppu.toLocaleString()} pts/user
              </span>
              <span className="text-gray-400 font-black">×</span>
              <span className="px-3 py-1.5 bg-white rounded-lg text-sm font-bold text-gray-700 shadow-sm">
                {userCount} users
              </span>
              <span className="text-gray-400 font-black">=</span>
              <span
                className={`px-3 py-1.5 rounded-lg text-sm font-black shadow-sm ${
                  hasEnoughPool
                    ? 'bg-sparknode-purple text-white'
                    : 'bg-red-500 text-white'
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
                Pool balance after: <strong>{(poolBalance - totalPoints).toLocaleString()} pts</strong>
              </span>
              <span>
                Dept balance after:{' '}
                <strong>
                  {(Number(selectedDept.current_balance) + totalPoints).toLocaleString()} pts
                </strong>
              </span>
            </div>

            <button
              onClick={() => setShowConfirm(true)}
              disabled={!canSubmit}
              className="w-full py-3 rounded-xl bg-sparknode-purple text-white font-bold text-sm hover:bg-sparknode-purple/90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <HiOutlineBanknotes className="w-5 h-5" />
              Distribute to {selectedDept.name}
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        isLoading={mutation.isPending}
        title="Confirm Department Distribution"
        lines={[
          `Department: ${selectedDept?.name}`,
          `Active employees: ${userCount}`,
          `Points per employee: ${ppu.toLocaleString()} pts`,
          `Total to allocate: ${totalPoints.toLocaleString()} pts`,
          `This will be deducted from the tenant pool.`,
        ]}
      />
    </div>
  )
}

// ── All Users Distribution Tab ────────────────────────────────────────────────

function AllUsersDistributionTab({ currency }) {
  const [pointsPerUser, setPointsPerUser] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [successResult, setSuccessResult] = useState(null)
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
    onSuccess: (res) => {
      setShowConfirm(false)
      setSuccessResult(res.data)
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

  const handleReset = () => {
    setSuccessResult(null)
    setPointsPerUser('')
  }

  if (successResult) return <SuccessResult result={successResult} onReset={handleReset} />

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
        title="Confirm Tenant-Wide Distribution"
        lines={[
          `This will credit ${ppu.toLocaleString()} pts to every active user.`,
          `Total users: ${totalUsers}`,
          `Total deducted from pool: ${totalPoints.toLocaleString()} pts`,
          `Points will be immediately available in employee wallets.`,
          `This action cannot be undone.`,
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
