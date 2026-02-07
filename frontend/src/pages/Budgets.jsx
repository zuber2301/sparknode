import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetsAPI, tenantsAPI, usersAPI, walletsAPI, analyticsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { formatCurrency } from '../lib/currency'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { 
  HiOutlinePlus, 
  HiOutlinePencil, 
  HiOutlineChartBar, 
  HiOutlineCheck,
  HiOutlineUsers,
  HiOutlineCurrencyDollar,
  HiOutlineTrendingUp
} from 'react-icons/hi'

export default function Budgets() {
  const [activeTab, setActiveTab] = useState('budgets') // 'budgets', 'departments', or 'spend-analysis'
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [showDeptAllocateModal, setShowDeptAllocateModal] = useState(false)
  const [showLeadAllocateModal, setShowLeadAllocateModal] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState(null)
  const [selectedDept, setSelectedDept] = useState(null)
  const [selectedLead, setSelectedLead] = useState(null)
  const [spendAnalysisPeriod, setSpendAnalysisPeriod] = useState('monthly')
  const queryClient = useQueryClient()
  const { isHRAdmin } = useAuthStore()

  // Fetch tenant config for currency settings
  const { data: tenantData } = useQuery({
    queryKey: ['tenant', 'current'],
    queryFn: () => tenantsAPI.getCurrentTenant()
  })

  const { data: budgets, isLoading: isLoadingBudgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsAPI.getAll(),
    enabled: true,
  })

  const { data: deptList, isLoading: isLoadingDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => tenantsAPI.getDepartments(),
    enabled: activeTab === 'departments',
  })

  const { data: spendAnalysis, isLoading: isLoadingSpendAnalysis } = useQuery({
    queryKey: ['spend-analysis', spendAnalysisPeriod],
    queryFn: () => analyticsAPI.getSpendAnalysis({ period_type: spendAnalysisPeriod }),
    enabled: activeTab === 'spend-analysis',
  })

  const activeBudget = budgets?.data?.find(b => b.status === 'active')

  const { data: deptBudgets, isLoading: isLoadingDeptBudgets } = useQuery({
    queryKey: ['deptBudgets', activeBudget?.id],
    queryFn: () => budgetsAPI.getDepartmentBudgets(activeBudget?.id),
    enabled: !!activeBudget && activeTab === 'departments',
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => tenantsAPI.getDepartments(),
  })

  const { data: departmentBudgets } = useQuery({
    queryKey: ['departmentBudgets', selectedBudget?.id],
    queryFn: () => budgetsAPI.getDepartmentBudgets(selectedBudget.id),
    enabled: !!selectedBudget,
  })

  // Helper to format budget values
  const formatBudgetValue = (value) => {
    const displayCurrency = tenantData?.display_currency || 'USD'
    const fxRate = parseFloat(tenantData?.fx_rate) || 1.0
    return formatCurrency(value, displayCurrency, fxRate)
  }

  const createMutation = useMutation({
    mutationFn: (data) => budgetsAPI.create(data),
    onSuccess: () => {
      toast.success('Budget created successfully')
      queryClient.invalidateQueries(['budgets'])
      setShowCreateModal(false)
    },
    onError: (error) => {
      const detail = error.response?.data?.detail || error.response?.data?.message || 'Failed to create budget'
      toast.error(typeof detail === 'string' ? detail : JSON.stringify(detail))
    },
  })

  const allocateMutation = useMutation({
    mutationFn: ({ id, data }) => budgetsAPI.allocate(id, data),
    onSuccess: () => {
      toast.success('Budget allocated successfully')
      queryClient.invalidateQueries(['budgets'])
      queryClient.invalidateQueries(['departmentBudgets'])
      setShowAllocateModal(false)
    },
    onError: (error) => {
      const detail = error.response?.data?.detail || error.response?.data?.message || 'Failed to allocate budget'
      toast.error(typeof detail === 'string' ? detail : JSON.stringify(detail))
    },
  })

  const leadAllocateMutation = useMutation({
    mutationFn: (data) => budgetsAPI.allocateLeadBudget(data),
    onSuccess: () => {
      toast.success('Points allocated to Lead')
      queryClient.invalidateQueries(['leadBudgets'])
      setShowLeadAllocateModal(false)
      setSelectedLead(null)
    },
    onError: (error) => {
      // Handle different error response formats
      let errorMessage = 'Failed to allocate points'
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.response?.data) {
        // Check if it's a Pydantic validation error
        if (Array.isArray(error.response.data)) {
          errorMessage = error.response.data
            .map(err => err.msg || JSON.stringify(err))
            .join(', ')
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data
        }
      }
      
      toast.error(typeof errorMessage === 'string' ? errorMessage : 'Failed to allocate points')
    },
  })

  const deptAllocateMutation = useMutation({
    mutationFn: (data) => budgetsAPI.allocate(data.budget_id, data),
    onSuccess: () => {
      toast.success('Budget allocated to department')
      queryClient.invalidateQueries(['deptBudgets'])
      setShowDeptAllocateModal(false)
      setSelectedDept(null)
    },
    onError: (error) => {
      let errorMessage = 'Failed to allocate budget'
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.response?.data) {
        if (Array.isArray(error.response.data)) {
          errorMessage = error.response.data
            .map(err => err.msg || JSON.stringify(err))
            .join(', ')
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data
        }
      }
      
      toast.error(typeof errorMessage === 'string' ? errorMessage : 'Failed to allocate budget')
    },
  })

  const activateMutation = useMutation({
    mutationFn: (id) => budgetsAPI.activate(id),
    onSuccess: () => {
      toast.success('Budget activated successfully')
      queryClient.invalidateQueries(['budgets'])
    },
    onError: (error) => {
      const detail = error.response?.data?.detail || error.response?.data?.message || 'Failed to activate budget'
      toast.error(typeof detail === 'string' ? detail : JSON.stringify(detail))
    },
  })

  const handleCreateBudget = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    createMutation.mutate({
      name: formData.get('name'),
      fiscal_year: parseInt(formData.get('fiscal_year')),
      fiscal_quarter: formData.get('fiscal_quarter') ? parseInt(formData.get('fiscal_quarter')) : null,
      total_points: parseFloat(formData.get('total_points')),
      expiry_date: formData.get('expiry_date'),
    })
  }

  const handleAllocate = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const allocations = []
    
    departments?.data?.forEach((dept) => {
      const points = formData.get(`points_${dept.id}`)
      if (points && parseFloat(points) > 0) {
        allocations.push({
          department_id: dept.id,
          allocated_points: parseFloat(points),
          monthly_cap: formData.get(`cap_${dept.id}`) ? parseFloat(formData.get(`cap_${dept.id}`)) : null,
        })
      }
    })

    if (allocations.length === 0) {
      toast.error('Please allocate points to at least one department')
      return
    }

    allocateMutation.mutate({
      id: selectedBudget.id,
      data: { allocations },
    })
  }

  const handleLeadAllocate = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    leadAllocateMutation.mutate({
      user_id: selectedLead.id,
      total_points: parseFloat(formData.get('points')),
      description: formData.get('description'),
    })
  }

  const handleDeptAllocate = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const points = parseFloat(formData.get('points'))
    
    if (!points || points <= 0) {
      toast.error('Points must be greater than 0')
      return
    }

    deptAllocateMutation.mutate({
      budget_id: activeBudget.id,
      allocations: [{
        department_id: selectedDept.id,
        allocated_points: points,
        monthly_cap: null,
      }]
    })
  }

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      closed: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (!isHRAdmin()) {
    return (
      <div className="card text-center py-12">
        <HiOutlineChartBar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500">Only HR Admins can manage budgets.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Budget Management</h1>
        {activeTab === 'budgets' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <HiOutlinePlus className="w-5 h-5" />
            Create Budget
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('budgets')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'budgets'
              ? 'border-sparknode-purple text-sparknode-purple'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <HiOutlineChartBar className="w-5 h-5" />
            Company Budgets
          </div>
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'departments'
              ? 'border-sparknode-purple text-sparknode-purple'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <HiOutlineUsers className="w-5 h-5" />
            Department Allocation
          </div>
        </button>
        <button
          onClick={() => setActiveTab('spend-analysis')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'spend-analysis'
              ? 'border-sparknode-purple text-sparknode-purple'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <HiOutlineTrendingUp className="w-5 h-5" />
            Spend Analysis
          </div>
        </button>
      </div>

      {activeTab === 'budgets' ? (
        <>
          {/* Budgets list */}
          {isLoadingBudgets ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : budgets?.data?.length > 0 ? (
            <div className="space-y-4">
              {budgets.data.map((budget) => (
                <div key={budget.id} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">{budget.name}</h3>
                        <span className={`badge ${getStatusColor(budget.status)}`}>
                          {budget.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        FY {budget.fiscal_year} {budget.fiscal_quarter && `Q${budget.fiscal_quarter}`}
                        {budget.expiry_date && !isNaN(new Date(budget.expiry_date).getTime()) && 
                          ` • Burn-by: ${format(new Date(budget.expiry_date), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {budget.status === 'draft' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedBudget(budget)
                              setShowAllocateModal(true)
                            }}
                            className="btn-secondary text-sm"
                          >
                            <HiOutlinePencil className="w-4 h-4 mr-1" />
                            Allocate
                          </button>
                          <button
                            onClick={() => activateMutation.mutate(budget.id)}
                            className="btn-primary text-sm"
                            disabled={activateMutation.isPending}
                          >
                            <HiOutlineCheck className="w-4 h-4 mr-1" />
                            Activate
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">Total Budget</p>
                      <p className="text-xl font-semibold text-gray-900">{formatBudgetValue(budget.total_points)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">Allocated</p>
                      <p className="text-xl font-semibold text-blue-600">{formatBudgetValue(budget.allocated_points)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">Remaining</p>
                      <p className="text-xl font-semibold text-green-600">{formatBudgetValue(budget.remaining_points)}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sparknode-purple to-sparknode-blue"
                        style={{
                          width: `${(Number(budget.allocated_points) / Number(budget.total_points)) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {((Number(budget.allocated_points) / Number(budget.total_points)) * 100).toFixed(1)}% allocated
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-12">
              <HiOutlineChartBar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No budgets yet</h3>
              <p className="text-gray-500 mb-4">Create your first budget to start allocating points.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                Create Budget
              </button>
            </div>
          )}
        </>
      ) : activeTab === 'departments' ? (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Department Allocation</h3>
                <p className="text-sm text-gray-500">Allocate budget to departments</p>
              </div>
            </div>

            {!activeBudget ? (
              <div className="text-center py-12 text-gray-500">
                <p>Please create and activate a budget first to allocate to departments.</p>
              </div>
            ) : isLoadingDepts ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : deptList?.data?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 uppercase">Department Name</th>
                      <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 uppercase">Allocated</th>
                      <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 uppercase">Used %</th>
                      <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 uppercase">Remaining</th>
                      <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {deptList.data.map((dept) => {
                      const budget = deptBudgets?.data?.find(db => (db.department_id || db.dept_id) === dept.id)
                      return (
                        <tr key={dept.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900">{dept.name}</div>
                          </td>
                          <td className="px-4 py-4 text-sm font-medium">
                            {budget ? Number(budget.allocated_points).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-4">
                            {budget ? (
                              <div className="w-24">
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-sparknode-purple" 
                                    style={{ width: `${budget.allocated_points > 0 ? ((Number(budget.spent_points) / Number(budget.allocated_points)) * 100) : 0}%` }} 
                                  />
                                </div>
                                <span className="text-[10px] text-gray-500">{budget.allocated_points > 0 ? ((Number(budget.spent_points) / Number(budget.allocated_points)) * 100).toFixed(1) : 0}% used</span>
                              </div>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-4 text-sm text-green-600 font-medium">
                            {budget ? (Number(budget.allocated_points) - Number(budget.spent_points)).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedDept(dept)
                                setShowDeptAllocateModal(true)
                              }}
                              className="btn-secondary text-sm flex items-center gap-2 ml-auto"
                            >
                              <HiOutlineCurrencyDollar className="w-4 h-4" />
                              {budget ? 'Update Budget' : 'Allocate Budget'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No departments found.
              </div>
            )}
          </div>
        </div>
      ) : null }

      {activeTab === 'spend-analysis' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Spend Analysis</h2>
              <p className="text-sm text-gray-500">Insights into your point distribution and budget health</p>
            </div>
            <select 
              value={spendAnalysisPeriod} 
              onChange={(e) => setSpendAnalysisPeriod(e.target.value)}
              className="input w-40"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {isLoadingSpendAnalysis ? (
            <div className="space-y-6">
              <div className="h-10 w-48 bg-gray-200 animate-pulse rounded-lg" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-80 bg-gray-100 animate-pulse rounded-xl" />
                <div className="h-80 bg-gray-100 animate-pulse rounded-xl" />
              </div>
            </div>
          ) : (
            <div className="card">
              <p className="text-gray-600">Spend analysis data will be displayed here.</p>
            </div>
          )}
        </div>
      )}

      {/* Create Budget Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Create New Budget</h2>
            <form onSubmit={handleCreateBudget} className="space-y-4">
              <div>
                <label className="label">Budget Name</label>
                <input name="name" className="input" required placeholder="e.g., FY 2026 Q1 Budget" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Fiscal Year</label>
                  <input
                    name="fiscal_year"
                    type="number"
                    className="input"
                    required
                    defaultValue={new Date().getFullYear()}
                  />
                </div>
                <div>
                  <label className="label">Quarter (optional)</label>
                  <select name="fiscal_quarter" className="input">
                    <option value="">Annual</option>
                    <option value="1">Q1</option>
                    <option value="2">Q2</option>
                    <option value="3">Q3</option>
                    <option value="4">Q4</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Total Points</label>
                <input
                  name="total_points"
                  type="number"
                  className="input"
                  required
                  placeholder="100000"
                />
              </div>
              <div>
                <label className="label">Expiry Date (Burn-by date)</label>
                <input
                  name="expiry_date"
                  type="date"
                  className="input"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Budget Modal */}
      {showAllocateModal && selectedBudget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-2">Allocate Budget</h2>
            <p className="text-gray-500 mb-4">
              {selectedBudget.name} - Available: {selectedBudget.remaining_points} points
            </p>
            <form onSubmit={handleAllocate} className="space-y-4">
              {departments?.data?.map((dept) => {
                const existing = departmentBudgets?.data?.find(
                  (db) => (db.department_id || db.dept_id) === dept.id
                )
                return (
                  <div key={dept.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{dept.name}</p>
                      {existing && (
                        <p className="text-sm text-gray-500">
                          Current: {existing.allocated_points} pts
                        </p>
                      )}
                    </div>
                    <div className="w-32">
                      <input
                        name={`points_${dept.id}`}
                        type="number"
                        className="input text-sm"
                        placeholder="Points"
                        min="0"
                      />
                    </div>
                    <div className="w-32">
                      <input
                        name={`cap_${dept.id}`}
                        type="number"
                        className="input text-sm"
                        placeholder="Monthly cap"
                        min="0"
                      />
                    </div>
                  </div>
                )
              })}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAllocateModal(false)
                    setSelectedBudget(null)
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocateMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {allocateMutation.isPending ? 'Allocating...' : 'Allocate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Budget to Department Modal */}
      {showDeptAllocateModal && selectedDept && activeBudget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-2">Allocate Budget to Department</h2>
            <p className="text-gray-500 mb-4">
              To: {selectedDept.name}
            </p>
            <form onSubmit={handleDeptAllocate} className="space-y-4">
              <div>
                <label className="label">Points to Allocate</label>
                <input
                  name="points"
                  type="number"
                  className="input"
                  required
                  min="1"
                  step="0.01"
                  placeholder="1000"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>Budget Remaining:</strong> {activeBudget.remaining_points.toLocaleString()} points
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeptAllocateModal(false)
                    setSelectedDept(null)
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deptAllocateMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {deptAllocateMutation.isPending ? 'Allocating...' : 'Allocate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Points to Lead Modal */}
      {showLeadAllocateModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-2">Allocate Points to Lead</h2>
            <p className="text-gray-500 mb-4">
              To: {selectedLead.first_name} {selectedLead.last_name} ({selectedLead.email})
            </p>
            <form onSubmit={handleLeadAllocate} className="space-y-4">
              <div>
                <label className="label">Points to Allocate</label>
                <input
                  name="points"
                  type="number"
                  className="input"
                  required
                  min="1"
                  placeholder="100"
                />
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <input
                  name="description"
                  className="input"
                  placeholder="e.g., Q1 Recognition Budget"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowLeadAllocateModal(false)
                    setSelectedLead(null)
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leadAllocateMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {leadAllocateMutation.isPending ? 'Allocating...' : 'Allocate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
