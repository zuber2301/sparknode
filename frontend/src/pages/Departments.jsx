import { useState, useEffect } from 'react'
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
  HiOutlineExclamation,
  HiOutlineCheck,
  HiOutlineX
} from 'react-icons/hi'

export default function Departments() {
  const [showAddPointsModal, setShowAddPointsModal] = useState(false)
  const [showAssignLeadModal, setShowAssignLeadModal] = useState(false)
  const [showCreateDeptModal, setShowCreateDeptModal] = useState(false)
  const [showRecallModal, setShowRecallModal] = useState(false)
  const [selectedDept, setSelectedDept] = useState(null)
  const [allocationAmount, setAllocationAmount] = useState('')
  const [recallAmount, setRecallAmount] = useState('')
  const [newDeptName, setNewDeptName] = useState('')
  const [newDeptAllocation, setNewDeptAllocation] = useState('')
  const [selectedLeadUserId, setSelectedLeadUserId] = useState('')
  const [deptNameCheck, setDeptNameCheck] = useState({ isChecking: false, exists: false, message: '' })
  const [newlyCreatedDeptId, setNewlyCreatedDeptId] = useState(null)
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

  const recallMutation = useMutation({
    mutationFn: ({ deptId, amount }) => tenantsAPI.recallDepartmentBudget(deptId, parseFloat(amount)),
    onSuccess: (response) => {
      toast.success(response.message)
      queryClient.invalidateQueries(['departments', 'management'])
      queryClient.invalidateQueries(['tenant', 'current'])
      setShowRecallModal(false)
      setSelectedDept(null)
      setRecallAmount('')
    },
    onError: (error) => {
      const detail = error.response?.data?.detail || error.message || 'Failed to recall budget'
      toast.error(detail)
    },
  })

  // Debounced department name checking
  useEffect(() => {
    if (!newDeptName.trim()) {
      setDeptNameCheck({ isChecking: false, exists: false, message: '' })
      return
    }

    const timeoutId = setTimeout(async () => {
      setDeptNameCheck({ isChecking: true, exists: false, message: '' })
      try {
        const response = await tenantsAPI.checkDepartmentName(newDeptName)
        setDeptNameCheck({ isChecking: false, exists: response.exists, message: response.message })
      } catch (error) {
        setDeptNameCheck({ isChecking: false, exists: false, message: '' })
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [newDeptName])

  const createDeptMutation = useMutation({
    mutationFn: (data) => tenantsAPI.createDepartmentWithAllocation(data),
    onSuccess: (response) => {
      toast.success(`Department "${response.department_name}" created successfully!`)
      queryClient.invalidateQueries(['departments', 'management'])
      queryClient.invalidateQueries(['tenant', 'current'])
      setNewlyCreatedDeptId(response.department_id)
      setShowCreateDeptModal(false)
      resetCreateForm()
      
      // Remove highlight after 3 seconds
      setTimeout(() => setNewlyCreatedDeptId(null), 3000)
    },
    onError: (error) => {
      const detail = error.response?.data?.detail || error.message || 'Failed to create department'
      toast.error(detail)
    },
  })

  const resetCreateForm = () => {
    setNewDeptName('')
    setNewDeptAllocation('')
    setSelectedLeadUserId('')
    setDeptNameCheck({ isChecking: false, exists: false, message: '' })
  }

  const handleAddPoints = (dept) => {
    setSelectedDept(dept)
    setShowAddPointsModal(true)
  }

  const handleAssignLead = (dept) => {
    setSelectedDept(dept)
    setShowAssignLeadModal(true)
  }

  const handleRecall = (dept) => {
    setSelectedDept(dept)
    setShowRecallModal(true)
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

  const submitRecall = () => {
    if (!recallAmount || parseFloat(recallAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (parseFloat(recallAmount) > selectedDept.unallocated_budget) {
      toast.error('Recall amount cannot exceed department balance')
      return
    }
    recallMutation.mutate({ deptId: selectedDept.id, amount: recallAmount })
  }

  const setRecallPercentage = (percentage) => {
    const amount = (selectedDept.unallocated_budget * percentage / 100).toFixed(2)
    setRecallAmount(amount)
  }

  const recallAll = () => {
    setRecallAmount(selectedDept.unallocated_budget.toString())
  }

  const handleCreateDepartment = () => {
    if (!newDeptName.trim()) {
      toast.error('Please enter a department name')
      return
    }

    if (deptNameCheck.exists) {
      toast.error('Department name already exists')
      return
    }

    const allocation = newDeptAllocation ? parseFloat(newDeptAllocation) : 0
    if (allocation < 0) {
      toast.error('Allocation amount cannot be negative')
      return
    }

    if (allocation > (tenant?.master_budget_balance || 0)) {
      toast.error('Allocation exceeds available master pool balance')
      return
    }

    createDeptMutation.mutate({
      name: newDeptName.trim(),
      initial_allocation: allocation,
      lead_user_id: selectedLeadUserId || null
    })
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
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Tenant Master Pool</p>
            <p className="text-2xl font-bold text-sparknode-purple">
              {formatBudgetValue(tenant?.master_budget_balance || 0)}
            </p>
          </div>
          <button
            onClick={() => setShowCreateDeptModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sparknode-purple text-white rounded-lg hover:bg-sparknode-purple/90 transition-colors"
          >
            <HiOutlinePlus className="w-4 h-4" />
            New Department
          </button>
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
                <tr 
                  key={dept.id} 
                  className={`hover:bg-gray-50 transition-colors ${
                    newlyCreatedDeptId === dept.id ? 'bg-green-50 border-l-4 border-green-500' : ''
                  }`}
                >
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
                    {dept.unallocated_budget > 0 && (
                      <button
                        onClick={() => handleRecall(dept)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        <HiOutlineX className="w-4 h-4" />
                        Recall
                      </button>
                    )}
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

      {/* Create Department Modal */}
      {showCreateDeptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Create New Department
            </h3>

            <div className="space-y-4">
              {/* Department Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department Name *
                </label>
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sparknode-purple focus:border-transparent"
                  placeholder="e.g., Customer Success"
                />
                {deptNameCheck.isChecking && (
                  <p className="text-sm text-gray-500 mt-1">Checking availability...</p>
                )}
                {deptNameCheck.exists && (
                  <div className="flex items-center gap-2 mt-1">
                    <HiOutlineX className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-600">{deptNameCheck.message}</p>
                  </div>
                )}
                {!deptNameCheck.exists && newDeptName.trim() && !deptNameCheck.isChecking && (
                  <div className="flex items-center gap-2 mt-1">
                    <HiOutlineCheck className="w-4 h-4 text-green-500" />
                    <p className="text-sm text-green-600">Department name is available</p>
                  </div>
                )}
              </div>

              {/* Initial Allocation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Allocation (Optional)
                </label>
                <input
                  type="number"
                  value={newDeptAllocation}
                  onChange={(e) => setNewDeptAllocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sparknode-purple focus:border-transparent"
                  placeholder="Points to allocate from master pool"
                  min="0"
                  step="0.01"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Available: {formatBudgetValue(tenant?.master_budget_balance || 0)}
                </p>
                {newDeptAllocation && parseFloat(newDeptAllocation) > (tenant?.master_budget_balance || 0) && (
                  <p className="text-sm text-red-600 mt-1">Amount exceeds available master pool balance</p>
                )}
              </div>

              {/* Assign Department Lead */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Department Lead (Optional)
                </label>
                <select
                  value={selectedLeadUserId}
                  onChange={(e) => setSelectedLeadUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sparknode-purple focus:border-transparent"
                >
                  <option value="">Select a user to promote to department lead...</option>
                  {users?.data?.filter(u => u.org_role !== 'dept_lead')?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.corporate_email})
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Selected user will be promoted to department lead role
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateDeptModal(false)
                  resetCreateForm()
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDepartment}
                disabled={createDeptMutation.isPending || deptNameCheck.exists || deptNameCheck.isChecking}
                className="flex-1 px-4 py-2 bg-sparknode-purple text-white rounded-lg hover:bg-sparknode-purple/90 transition-colors disabled:opacity-50"
              >
                {createDeptMutation.isPending ? 'Creating...' : 'Create Department'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recall Budget Modal */}
      {showRecallModal && selectedDept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recall Budget: {selectedDept.name}
            </h3>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Current Department Balance</p>
              <p className="text-xl font-bold text-sparknode-purple">
                {formatBudgetValue(selectedDept.unallocated_budget)}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount to Recall
              </label>
              <input
                type="number"
                value={recallAmount}
                onChange={(e) => setRecallAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Enter amount"
                min="0"
                max={selectedDept.unallocated_budget}
                step="0.01"
              />
            </div>

            {/* Quick Toggle Buttons */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Quick Select:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setRecallPercentage(25)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  25%
                </button>
                <button
                  onClick={() => setRecallPercentage(50)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  50%
                </button>
                <button
                  onClick={recallAll}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                >
                  Recall All
                </button>
              </div>
            </div>

            {recallAmount && parseFloat(recallAmount) > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Preview:</p>
                <p className="text-sm">
                  New Dept Balance: <span className="font-medium">{formatBudgetValue(selectedDept.unallocated_budget - parseFloat(recallAmount))}</span>
                </p>
                <p className="text-sm">
                  New Master Pool: <span className="font-medium">{formatBudgetValue((tenant?.master_budget_balance || 0) + parseFloat(recallAmount))}</span>
                </p>
              </div>
            )}

            <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-start gap-2">
                <HiOutlineExclamation className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Warning:</p>
                  <p>This will reduce the points available for the Department Lead to distribute. It will not affect points already in employee wallets.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRecallModal(false)
                  setSelectedDept(null)
                  setRecallAmount('')
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitRecall}
                disabled={recallMutation.isPending || !recallAmount || parseFloat(recallAmount) <= 0}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {recallMutation.isPending ? 'Recalling...' : 'Recall Budget'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
