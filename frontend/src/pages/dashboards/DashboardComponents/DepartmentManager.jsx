import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantsAPI, usersAPI } from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import { formatCurrency } from '../../../lib/currency'
import toast from 'react-hot-toast'
import { 
  HiOutlineOfficeBuilding, 
  HiOutlinePlus, 
  HiOutlinePencil, 
  HiOutlineCurrencyDollar,
  HiOutlineUserAdd,
  HiOutlineExclamation,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineDotsVertical
} from 'react-icons/hi'
import { HiArrowPath } from 'react-icons/hi2'

export default function DepartmentManager({ onRefresh }) {
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

  // UI state for action dropdowns and editing
  const [activeDeptDropdown, setActiveDeptDropdown] = useState(null)
  const [showEditDeptModal, setShowEditDeptModal] = useState(false)
  const [editDept, setEditDept] = useState(null)
  const [editDeptName, setEditDeptName] = useState('')

  const queryClient = useQueryClient()

  const { data: tenant } = useQuery({
    queryKey: ['tenant', 'current'],
    queryFn: () => tenantsAPI.getCurrent(),
  })

  const { data: deptManagement, isLoading, refetch } = useQuery({
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
      if (onRefresh) onRefresh()
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
      if (onRefresh) onRefresh()
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
      if (onRefresh) onRefresh()
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
      if (onRefresh) onRefresh()
      setNewlyCreatedDeptId(response.department_id)
      setShowCreateDeptModal(false)
      resetCreateForm()
      setTimeout(() => setNewlyCreatedDeptId(null), 3000)
    },
    onError: (error) => {
      let detail = error.response?.data?.detail || error.message || 'Failed to create department'
      if (Array.isArray(detail)) {
        detail = detail.map(err => err.msg || err.message).join(', ')
      } else if (typeof detail === 'object' && detail !== null) {
        detail = detail.message || detail.msg || JSON.stringify(detail)
      }
      toast.error(detail)
    },
  })

  const editDeptMutation = useMutation({
    mutationFn: ({ deptId, data }) => tenantsAPI.updateDepartment(deptId, data),
    onSuccess: (response) => {
      toast.success('Department updated successfully')
      queryClient.invalidateQueries(['departments', 'management'])
      if (onRefresh) onRefresh()
      setShowEditDeptModal(false)
      setEditDept(null)
      setEditDeptName('')
    },
    onError: (error) => {
      const detail = error.response?.data?.detail || error.message || 'Failed to update department'
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
    const allocation = newDeptAllocation ? parseFloat(newDeptAllocation) || 0 : 0
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
      lead_user_id: selectedLeadUserId || undefined
    })
  }

  const openEditDeptModal = (dept) => {
    setEditDept(dept)
    setEditDeptName(dept.name || '')
    setShowEditDeptModal(true)
  }

  const submitEditDept = () => {
    if (!editDeptName.trim()) {
      toast.error('Please enter a department name')
      return
    }
    editDeptMutation.mutate({ deptId: editDept.id, data: { name: editDeptName.trim() } })
  }

  const formatBudgetValue = (value) => {
    const displayCurrency = tenant?.display_currency || 'USD'
    const fxRate = parseFloat(tenant?.fx_rate) || 1.0
    return formatCurrency(value, displayCurrency, fxRate)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Department Management</h3>
          <p className="text-sm text-gray-400 font-medium">Monitor points and allocation flow</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-400 hover:text-sparknode-purple transition-colors"
            title="Refresh list"
          >
            <HiArrowPath className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateDeptModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sparknode-purple text-white rounded-xl hover:bg-sparknode-purple/90 transition shadow-sm font-bold text-sm"
          >
            <HiOutlinePlus className="w-4 h-4" />
            New Department
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Department Name</th>
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Dept Lead</th>
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Unallocated Budget</th>
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">User Wallet Sum</th>
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Total Dept Liability</th>
              <th className="text-right py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider space-x-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan="6" className="py-6 px-6"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                </tr>
              ))
            ) : (
              deptManagement?.data?.map((dept) => (
                <tr 
                  key={dept.id} 
                  className={`hover:bg-gray-50/50 transition ${
                    newlyCreatedDeptId === dept.id ? 'bg-green-50' : ''
                  }`}
                >
                  <td className="py-4 px-6">
                    <div className="text-sm font-bold text-gray-900">{dept.name}</div>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-500 font-medium whitespace-nowrap">
                    {dept.dept_lead_name || <span className="text-gray-300 italic">Unassigned</span>}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-900">
                        {formatBudgetValue(dept.unallocated_budget)}
                      </span>
                      {dept.unallocated_budget === 0 && (
                        <HiOutlineExclamation className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-500 font-medium">
                    {formatBudgetValue(dept.user_wallet_sum)}
                  </td>
                  <td className="py-4 px-6 text-sm font-bold text-gray-900">
                    {formatBudgetValue(dept.total_liability)}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleAddPoints(dept)}
                        className="text-[10px] font-bold uppercase tracking-wider text-sparknode-purple hover:text-sparknode-purple/80 flex items-center gap-1"
                      >
                        <HiOutlinePlus className="w-3 h-3" />
                        Add Points
                      </button>
                      
                      {dept.dept_lead_name ? (
                        <button 
                          className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 flex items-center gap-1"
                        >
                          View Users
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAssignLead(dept)}
                          className="text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:text-amber-600/80 flex items-center gap-1"
                        >
                          Assign Lead
                        </button>
                      )}

                      <div className="relative inline-block text-left">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveDeptDropdown(activeDeptDropdown === dept.id ? null : dept.id)
                          }}
                          className="p-1 text-gray-300 hover:text-gray-500 transition-colors"
                        >
                          <HiOutlineDotsVertical className="w-4 h-4" />
                        </button>

                        {activeDeptDropdown === dept.id && (
                          <div 
                            className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-20 py-2"
                            onMouseLeave={() => setActiveDeptDropdown(null)}
                          >
                            <button
                              onClick={() => {
                                setActiveDeptDropdown(null)
                                handleRecall(dept)
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <HiArrowPath className="w-4 h-4" />
                              Recall Budget
                            </button>
                            <div className="border-t border-gray-50 my-1"></div>
                            <button
                              onClick={() => {
                                setActiveDeptDropdown(null)
                                openEditDeptModal(dept)
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <HiOutlinePencil className="w-4 h-4 text-gray-400" />
                              Edit Name
                            </button>
                            <button
                              onClick={() => {
                                setActiveDeptDropdown(null)
                                handleAssignLead(dept)
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <HiOutlineUserAdd className="w-4 h-4 text-blue-500" />
                              Change Lead
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals - Simplified for Dashboard Integration */}
      {showAddPointsModal && selectedDept && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-black text-gray-900 mb-6">Allocate Points</h3>
            <p className="text-sm text-gray-500 mb-4 font-medium italic">Adding points to <span className="text-sparknode-purple font-bold">"{selectedDept.name}"</span></p>
            
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Available Master Pool</p>
              <p className="text-2xl font-black text-sparknode-purple">
                {formatBudgetValue(tenant?.master_budget_balance || 0)}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                Amount to Allocate
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={allocationAmount}
                  onChange={(e) => setAllocationAmount(e.target.value)}
                  className="w-full pl-4 pr-12 py-3 bg-gray-50 border-transparent rounded-xl focus:ring-2 focus:ring-sparknode-purple focus:bg-white transition"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { setShowAddPointsModal(false); setAllocationAmount('') }}
                className="flex-1 px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={submitAllocation}
                disabled={allocateMutation.isPending || !allocationAmount}
                className="flex-1 px-6 py-3 bg-sparknode-purple text-white text-sm font-bold rounded-xl hover:bg-sparknode-purple/90 transition shadow-lg disabled:opacity-50"
              >
                {allocateMutation.isPending ? 'Syncing...' : 'Confirm Allocation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecallModal && selectedDept && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-black text-gray-900 mb-6 font-medium">Recall Budget</h3>
            <p className="text-sm text-gray-500 mb-4 font-medium italic">Recalling from <span className="text-red-500 font-bold">"{selectedDept.name}"</span></p>

            <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-100">
              <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Current Unallocated Balance</p>
              <p className="text-2xl font-black text-red-600">
                {formatBudgetValue(selectedDept.unallocated_budget)}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Amount to Recall</label>
              <input
                type="number"
                value={recallAmount}
                onChange={(e) => setRecallAmount(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border-transparent rounded-xl focus:ring-2 focus:ring-red-500 focus:bg-white transition"
                placeholder="0.00"
              />
              <div className="flex gap-2 mt-3">
                {[25, 50, 100].map(pct => (
                  <button
                    key={pct}
                    onClick={() => pct === 100 ? recallAll() : setRecallPercentage(pct)}
                    className="flex-1 py-1.5 text-xs font-bold bg-white border border-gray-100 text-gray-500 hover:border-red-200 hover:text-red-500 rounded-lg transition"
                  >
                    {pct === 100 ? 'ALL' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { setShowRecallModal(false); setRecallAmount('') }}
                className="flex-1 px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={submitRecall}
                disabled={recallMutation.isPending || !recallAmount}
                className="flex-1 px-6 py-3 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition shadow-lg disabled:opacity-50"
              >
                Recall
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignLeadModal && selectedDept && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-black text-gray-900 mb-6">Assign Dept Lead</h3>
            <p className="text-sm text-gray-500 mb-4 font-medium italic">Selecting leader for <span className="text-blue-500 font-bold">"{selectedDept.name}"</span></p>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Select User</label>
              <select
                onChange={(e) => submitAssignLead(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition font-medium"
                defaultValue=""
              >
                <option value="" disabled>Choose an employee...</option>
                {users?.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.corporate_email})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowAssignLeadModal(false)}
              className="w-full px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showCreateDeptModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-black text-gray-900 mb-6">Create New Department</h3>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Department Name</label>
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-transparent rounded-xl focus:ring-2 focus:ring-sparknode-purple focus:bg-white transition"
                  placeholder="e.g., Engineering"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Initial Allocation</label>
                <input
                  type="number"
                  value={newDeptAllocation}
                  onChange={(e) => setNewDeptAllocation(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-transparent rounded-xl focus:ring-2 focus:ring-sparknode-purple focus:bg-white transition"
                  placeholder="0.00"
                />
                <p className="mt-2 text-[10px] font-bold text-gray-400">AVAILABLE POOL: {formatBudgetValue(tenant?.master_budget_balance || 0)}</p>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => { setShowCreateDeptModal(false); resetCreateForm() }}
                className="flex-1 px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDepartment}
                disabled={createDeptMutation.isPending || !newDeptName}
                className="flex-1 px-6 py-3 bg-sparknode-purple text-white text-sm font-bold rounded-xl hover:bg-sparknode-purple/90 transition shadow-lg disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditDeptModal && editDept && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-black text-gray-900 mb-6 text-xl">Rename Department</h3>
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">New Name</label>
              <input
                type="text"
                value={editDeptName}
                onChange={(e) => setEditDeptName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border-transparent rounded-xl focus:ring-2 focus:ring-sparknode-purple focus:bg-white transition"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { setShowEditDeptModal(false); setEditDept(null); setEditDeptName('') }}
                className="flex-1 px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={submitEditDept}
                disabled={editDeptMutation.isPending || !editDeptName}
                className="flex-1 px-6 py-3 bg-sparknode-purple text-white text-sm font-bold rounded-xl hover:bg-sparknode-purple/90 transition shadow-lg disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
