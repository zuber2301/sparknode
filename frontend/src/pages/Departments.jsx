import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantsAPI, usersAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { formatCurrency } from '../lib/currency'
import toast from 'react-hot-toast'
import { 
  HiOutlineOfficeBuilding, 
  HiOutlinePlus, 
  HiOutlinePencil, 
  HiOutlineTrash,
  HiOutlineCurrencyDollar,
  HiOutlineUsers,
  HiOutlineUserAdd,
  HiOutlineExclamation
} from 'react-icons/hi'

export default function Departments() {
  const [showAddPointsModal, setShowAddPointsModal] = useState(false)
  const [showAssignLeadModal, setShowAssignLeadModal] = useState(false)
  const [selectedDept, setSelectedDept] = useState(null)
  const [allocationAmount, setAllocationAmount] = useState('')
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const { data: tenant } = useQuery({
    queryKey: ['tenant', 'current'],
    queryFn: () => tenantsAPI.getCurrent(),
  })

  const { data: deptManagement, isLoading } = useQuery({
    queryKey: ['departments', 'management'],
    queryFn: () => tenantsAPI.getDepartmentManagement(),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getAll(),
  })

  const allocateMutation = useMutation({
    mutationFn: ({ deptId, amount }) => tenantsAPI.allocateDepartmentBudget(deptId, parseFloat(amount)),
    onSuccess: (response) => {
      toast.success(response.message)
      queryClient.invalidateQueries(['departments', 'management'])
      queryClient.invalidateQueries(['tenant', 'current'])
      setShowAddPointsModal(false)
      setSelectedDept(null)
      setAllocationAmount('')
    },
    onError: (error) => {
      const detail = error.response?.data?.detail || error.message || 'Failed to allocate budget'
      toast.error(detail)
    },
  })

  const assignLeadMutation = useMutation({
    mutationFn: ({ deptId, userId }) => tenantsAPI.assignDepartmentLead(deptId, userId),
    onSuccess: (response) => {
      toast.success(response.message)
      queryClient.invalidateQueries(['departments', 'management'])
      setShowAssignLeadModal(false)
      setSelectedDept(null)
    },
    onError: (error) => {
      const detail = error.response?.data?.detail || error.message || 'Failed to assign lead'
      toast.error(detail)
    },
  })

  const handleAddPoints = (dept) => {
    setSelectedDept(dept)
    setShowAddPointsModal(true)
  }

  const handleAssignLead = (dept) => {
    setSelectedDept(dept)
    setShowAssignLeadModal(true)
  }

  const submitAllocation = () => {
    if (!allocationAmount || parseFloat(allocationAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    allocateMutation.mutate({ deptId: selectedDept.id, amount: allocationAmount })
  }

  const submitAssignLead = (userId) => {
    assignLeadMutation.mutate({ deptId: selectedDept.id, userId })
  }

  const formatBudgetValue = (value) => {
    const displayCurrency = tenant?.display_currency || 'USD'
    const fxRate = parseFloat(tenant?.fx_rate) || 1.0
    return formatCurrency(value, displayCurrency, fxRate)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sparknode-purple"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Department Management</h1>
          <p className="text-gray-600">Monitor department budgets and point allocation flow</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Tenant Master Pool</p>
          <p className="text-2xl font-bold text-sparknode-purple">
            {formatBudgetValue(tenant?.master_budget_balance || 0)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase">Department Name</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase">Dept Lead</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase">Unallocated Budget</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase">User Wallet Sum</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase">Total Dept Liability</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {deptManagement?.data?.map((dept) => (
                <tr key={dept.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-sparknode-purple/10 rounded-lg">
                        <HiOutlineOfficeBuilding className="w-5 h-5 text-sparknode-purple" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{dept.name}</div>
                        <div className="text-sm text-gray-500">{dept.employee_count} employees</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {dept.dept_lead_name || <span className="text-gray-400 italic">Unassigned</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {formatBudgetValue(dept.unallocated_budget)}
                      </span>
                      {dept.unallocated_budget === 0 && (
                        <HiOutlineExclamation className="w-4 h-4 text-red-500" title="Zero balance - needs refill" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatBudgetValue(dept.user_wallet_sum)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {formatBudgetValue(dept.total_liability)}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleAddPoints(dept)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-sparknode-purple text-white rounded hover:bg-sparknode-purple/90 transition-colors"
                    >
                      <HiOutlineCurrencyDollar className="w-4 h-4" />
                      Add Points
                    </button>
                    {!dept.dept_lead_name ? (
                      <button
                        onClick={() => handleAssignLead(dept)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                      >
                        <HiOutlineUserAdd className="w-4 h-4" />
                        Assign Lead
                      </button>
                    ) : (
                      <button
                        onClick={() => {/* TODO: Navigate to department users */}}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                      >
                        <HiOutlineUsers className="w-4 h-4" />
                        View Users
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Points Modal */}
      {showAddPointsModal && selectedDept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Points to {selectedDept.name}
            </h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Tenant Master Pool Balance</p>
              <p className="text-xl font-bold text-sparknode-purple">
                {formatBudgetValue(tenant?.master_budget_balance || 0)}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount to Allocate
              </label>
              <input
                type="number"
                value={allocationAmount}
                onChange={(e) => setAllocationAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sparknode-purple focus:border-transparent"
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
            </div>

            {allocationAmount && parseFloat(allocationAmount) > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Preview:</p>
                <p className="text-sm">
                  New Master Pool: <span className="font-medium">{formatBudgetValue((tenant?.master_budget_balance || 0) - parseFloat(allocationAmount))}</span>
                </p>
                <p className="text-sm">
                  New Dept Budget: <span className="font-medium">{formatBudgetValue(selectedDept.unallocated_budget + parseFloat(allocationAmount))}</span>
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddPointsModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitAllocation}
                disabled={allocateMutation.isPending}
                className="flex-1 px-4 py-2 bg-sparknode-purple text-white rounded-lg hover:bg-sparknode-purple/90 transition-colors disabled:opacity-50"
              >
                {allocateMutation.isPending ? 'Allocating...' : 'Allocate Points'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Lead Modal */}
      {showAssignLeadModal && selectedDept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assign Department Lead for {selectedDept.name}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select User
              </label>
              <select
                onChange={(e) => submitAssignLead(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sparknode-purple focus:border-transparent"
                defaultValue=""
              >
                <option value="" disabled>Select a user...</option>
                {users?.data?.filter(u => u.dept_id === selectedDept.id)?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.corporate_email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAssignLeadModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}