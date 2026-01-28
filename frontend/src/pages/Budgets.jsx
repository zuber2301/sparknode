import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetsAPI, tenantsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineChartBar, HiOutlineCheck } from 'react-icons/hi'

export default function Budgets() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState(null)
  const queryClient = useQueryClient()
  const { isHRAdmin } = useAuthStore()

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsAPI.getAll(),
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

  const createMutation = useMutation({
    mutationFn: (data) => budgetsAPI.create(data),
    onSuccess: () => {
      toast.success('Budget created successfully')
      queryClient.invalidateQueries(['budgets'])
      setShowCreateModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create budget')
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
      toast.error(error.response?.data?.detail || 'Failed to allocate budget')
    },
  })

  const activateMutation = useMutation({
    mutationFn: (id) => budgetsAPI.activate(id),
    onSuccess: () => {
      toast.success('Budget activated successfully')
      queryClient.invalidateQueries(['budgets'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to activate budget')
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
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Create Budget
        </button>
      </div>

      {/* Budgets list */}
      {isLoading ? (
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
                  <p className="text-xl font-semibold text-gray-900">{budget.total_points}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Allocated</p>
                  <p className="text-xl font-semibold text-blue-600">{budget.allocated_points}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Remaining</p>
                  <p className="text-xl font-semibold text-green-600">{budget.remaining_points}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sparknode-purple to-sparknode-blue"
                    style={{
                      width: `${(budget.allocated_points / budget.total_points) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {((budget.allocated_points / budget.total_points) * 100).toFixed(1)}% allocated
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
                  (db) => db.department_id === dept.id
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
    </div>
  )
}
