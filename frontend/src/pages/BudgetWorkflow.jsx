/**
 * Budget Allocation Workflow Page
 * Three-level budget allocation UI:
 * 1. Platform Admin: Allocates to Tenant (Total Allocated Budget)
 * 2. Tenant Manager: Distributes to Departments
 * 3. Department Lead: Distributes to Employees (as points)
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { formatDisplayValue } from '../lib/currency'
import {
  HiOutlinePlus,
  HiOutlineChevronRight,
  HiOutlineUsers,
  HiOutlineCurrencyDollar,
  HiOutlineCheck,
  HiOutlineExclamation,
  HiOutlineArrowRight,
  HiOutlineRefresh,
  HiOutlineChartBar
} from 'react-icons/hi'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

// API Functions
const budgetWorkflowAPI = {
  // Level 1: Tenant Allocation
  allocateTenantBudget: async (tenantId, data) => {
    const response = await fetch(`${API_BASE}/budget-workflow/tenant-allocation?tenant_id=${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  },

  getTenantAllocation: async (tenantId) => {
    const response = await fetch(`${API_BASE}/budget-workflow/tenant-allocation/${tenantId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  },

  // Level 2: Department Allocation
  allocateDepartmentBudget: async (data) => {
    const response = await fetch(`${API_BASE}/budget-workflow/department-allocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  },

  getDepartmentAllocations: async (tenantAllocationId = null) => {
    let url = `${API_BASE}/budget-workflow/department-allocations`
    if (tenantAllocationId) url += `?tenant_budget_allocation_id=${tenantAllocationId}`
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  },

  // Level 3: Employee Allocation
  allocateEmployeePoints: async (data) => {
    const response = await fetch(`${API_BASE}/budget-workflow/employee-allocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  },

  getEmployeeAllocations: async (deptAllocationId = null) => {
    let url = `${API_BASE}/budget-workflow/employee-allocations`
    if (deptAllocationId) url += `?department_budget_allocation_id=${deptAllocationId}`
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  },

  // Summaries
  getTenantSummary: async (tenantId) => {
    const response = await fetch(`${API_BASE}/budget-workflow/summary/tenant/${tenantId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  },

  getDepartmentSummary: async (deptAllocationId) => {
    const response = await fetch(`${API_BASE}/budget-workflow/summary/department/${deptAllocationId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  },

  // Get all tenant allocations (for platform admin)
  getAllTenantAllocations: async () => {
    const response = await fetch(`${API_BASE}/budget-workflow/tenant-allocations`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  }
}

// Tenant API for departments
const tenantsAPI = {
  getDepartments: async () => {
    const response = await fetch(`${API_BASE}/tenants/departments`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  }
}

// Users API
const usersAPI = {
  getUsersByDepartment: async (departmentId) => {
    const response = await fetch(`${API_BASE}/users?department_id=${departmentId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    if (!response.ok) throw new Error(await response.text())
    return response.json()
  }
}

export default function BudgetWorkflow() {
  const { user, tenantContext } = useAuthStore()
  const [activeLevel, setActiveLevel] = useState(1) // 1, 2, or 3
  const [selectedDeptAllocation, setSelectedDeptAllocation] = useState(null)
  const queryClient = useQueryClient()

  // Use currency from tenant settings if available
  const currencyCode = tenantContext?.settings?.currency || user?.display_currency || 'INR'

  // Fetch current tenant's allocation (Total Allocated Budget)
  const { data: tenantAllocation, isLoading: loadingTenantAlloc } = useQuery({
    queryKey: ['budget-workflow', 'tenant-allocation', user?.tenant_id],
    queryFn: () => budgetWorkflowAPI.getTenantAllocation(user?.tenant_id),
    enabled: !!user?.tenant_id && (user?.org_role === 'platform_admin' || user?.org_role === 'tenant_manager'),
  })

  // Fetch department allocations
  const { data: deptAllocations, isLoading: loadingDeptAlloc } = useQuery({
    queryKey: ['budget-workflow', 'department-allocations', tenantAllocation?.id],
    queryFn: () => budgetWorkflowAPI.getDepartmentAllocations(tenantAllocation?.id),
    enabled: !!tenantAllocation?.id && (user?.org_role === 'tenant_manager' || user?.org_role === 'dept_lead'),
  })

  // Fetch employee allocations for selected department
  const { data: employeeAllocations, isLoading: loadingEmpAlloc } = useQuery({
    queryKey: ['budget-workflow', 'employee-allocations', selectedDeptAllocation?.id],
    queryFn: () => budgetWorkflowAPI.getEmployeeAllocations(selectedDeptAllocation?.id),
    enabled: !!selectedDeptAllocation?.id && (user?.org_role === 'dept_lead'),
  })

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => tenantsAPI.getDepartments(),
    enabled: user?.org_role === 'tenant_manager'
  })

  // Fetch users for a department
  const [selectedDept, setSelectedDept] = useState(null)
  const { data: deptUsers } = useQuery({
    queryKey: ['users', 'by-department', selectedDept?.id],
    queryFn: () => usersAPI.getUsersByDepartment(selectedDept?.id),
    enabled: !!selectedDept?.id && (user?.org_role === 'dept_lead')
  })

  // Check user role and show appropriate level
  const isPlatformAdmin = user?.org_role === 'platform_admin'
  const isTenantManager = user?.org_role === 'tenant_manager'
  const isDeptLead = user?.org_role === 'dept_lead'

  if (isPlatformAdmin) {
    return <PlatformAdminView />
  }

  if (isTenantManager) {
    return (
      <TenantManagerView
        tenantAllocation={tenantAllocation}
        deptAllocations={deptAllocations}
        departments={departments}
        loading={loadingTenantAlloc || loadingDeptAlloc}
        queryClient={queryClient}
        currencyCode={currencyCode}
      />
    )
  }

  if (isDeptLead) {
    return (
      <DepartmentLeadView
        deptAllocations={deptAllocations}
        employeeAllocations={employeeAllocations}
        deptUsers={deptUsers}
        user={user}
        loading={loadingDeptAlloc || loadingEmpAlloc}
        selectedDeptAllocation={selectedDeptAllocation}
        setSelectedDeptAllocation={setSelectedDeptAllocation}
        queryClient={queryClient}
        currencyCode={currencyCode}
      />
    )
  }

  return (
    <div className="p-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <HiOutlineExclamation className="w-5 h-5 text-yellow-600" />
          <p className="text-yellow-800">You do not have permission to access budget allocation features.</p>
        </div>
      </div>
    </div>
  )
}

// ======== PLATFORM ADMIN VIEW ========
function PlatformAdminView() {
  const { user } = useAuthStore()
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const queryClient = useQueryClient()

  // Fetch all tenant allocations
  const { data: tenantAllocations, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['budget-workflow', 'all-tenant-allocations'],
    queryFn: () => budgetWorkflowAPI.getAllTenantAllocations(),
    enabled: true
  })

  const allocateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`${API_BASE}/budget-workflow/tenant-allocation?tenant_id=${data.tenant_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ total_allocated_budget: parseFloat(data.total_allocated_budget) })
      })
      if (!response.ok) throw new Error(await response.text())
      return response.json()
    },
    onSuccess: () => {
      toast.success('Budget allocated successfully')
      setShowAllocateModal(false)
      queryClient.invalidateQueries({ queryKey: ['budget-workflow'] })
    },
    onError: (error) => {
      toast.error('Failed to allocate budget: ' + error.message)
    }
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Budget Allocation</h1>
        <p className="text-gray-600">Allocate budgets to tenants</p>
      </div>

      <div className="mb-6 flex justify-end gap-2">
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <HiOutlineRefresh className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`} />
          Load Allocated Budget
        </button>
        <button
          onClick={() => setShowAllocateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Allocate Budget to Tenant
        </button>
      </div>

      {/* Allocation Modal */}
      {showAllocateModal && (
        <AllocateTenantBudgetModal
          onClose={() => setShowAllocateModal(false)}
          onSubmit={(data) => allocateMutation.mutate(data)}
          loading={allocateMutation.isPending}
        />
      )}

      {/* Tenants Grid */}
      <TenantsAllocationGrid 
        allocations={tenantAllocations || []} 
        loading={isLoading}
      />
    </div>
  )
}

// ======== TENANT MANAGER VIEW ========
function TenantManagerView({ tenantAllocation, deptAllocations, departments, loading, queryClient, currencyCode }) {
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [selectedDept, setSelectedDept] = useState(null)

  const allocateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`${API_BASE}/budget-workflow/department-allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          tenant_budget_allocation_id: tenantAllocation.id,
          department_id: data.department_id,
          allocated_budget: parseFloat(data.allocated_budget)
        })
      })
      if (!response.ok) throw new Error(await response.text())
      return response.json()
    },
    onSuccess: () => {
      toast.success('Department budget allocated successfully')
      setShowAllocateModal(false)
      queryClient.invalidateQueries({ queryKey: ['budget-workflow'] })
    },
    onError: (error) => {
      toast.error('Failed: ' + error.message)
    }
  })

  if (loading) return <LoadingSpinner />

  if (!tenantAllocation) {
    return (
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">No budget allocation set by platform admin yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Budget Distribution</h1>
        <p className="text-gray-600">Distribute budget from Company Pool (Master) to departments</p>
      </div>

      {/* Company Pool (Master) Card */}
      <BudgetAllocationCard
        title="Company Pool (Master)"
        total={tenantAllocation.total_allocated_budget}
        distributed={tenantAllocation.total_allocated_budget - tenantAllocation.remaining_balance}
        remaining={tenantAllocation.remaining_balance}
        percentage={(((tenantAllocation.total_allocated_budget - tenantAllocation.remaining_balance) / tenantAllocation.total_allocated_budget) * 100).toFixed(1)}
        currencyCode={currencyCode}
      />

      <div className="mt-8 mb-6 flex justify-end">
        <button
          onClick={() => setShowAllocateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Allocate to Department
        </button>
      </div>

      {showAllocateModal && (
        <AllocateDepartmentBudgetModal
          departments={departments}
          onClose={() => setShowAllocateModal(false)}
          onSubmit={(data) => allocateMutation.mutate(data)}
          loading={allocateMutation.isPending}
          maxBudget={tenantAllocation.remaining_balance}
          currencyCode={currencyCode}
        />
      )}

      {/* Department Allocations */}
      <DepartmentAllocationsGrid
        allocations={deptAllocations || []}
        departments={departments || []}
        currencyCode={currencyCode}
      />
    </div>
  )
}

// ======== DEPARTMENT LEAD VIEW ========
function DepartmentLeadView({
  deptAllocations,
  employeeAllocations,
  deptUsers,
  user,
  loading,
  selectedDeptAllocation,
  setSelectedDeptAllocation,
  queryClient,
  currencyCode
}) {
  const [showAllocateModal, setShowAllocateModal] = useState(false)

  const allocateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`${API_BASE}/budget-workflow/employee-allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          department_budget_allocation_id: selectedDeptAllocation.id,
          employee_id: data.employee_id,
          allocated_points: parseFloat(data.allocated_points)
        })
      })
      if (!response.ok) throw new Error(await response.text())
      return response.json()
    },
    onSuccess: () => {
      toast.success('Points allocated to employee successfully')
      setShowAllocateModal(false)
      queryClient.invalidateQueries({ queryKey: ['budget-workflow'] })
    },
    onError: (error) => {
      toast.error('Failed: ' + error.message)
    }
  })

  if (loading) return <LoadingSpinner />

  // Find department allocation for current user's department
  const myDeptAllocation = deptAllocations?.find(a => a.department_id === user?.department_id)

  if (!myDeptAllocation) {
    return (
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">No budget allocation for your department yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Distribute Points to Team</h1>
        <p className="text-gray-600">Allocate points from department budget to individual team members</p>
      </div>

      {/* Department Budget Card */}
      <BudgetAllocationCard
        title="Department Budget"
        total={myDeptAllocation.allocated_budget}
        distributed={myDeptAllocation.distributed_budget}
        remaining={myDeptAllocation.remaining_budget}
        percentage={(((myDeptAllocation.distributed_budget) / (myDeptAllocation.allocated_budget)) * 100).toFixed(1)}
        currencyCode={currencyCode}
      />

      <div className="mt-8 mb-6 flex justify-end">
        <button
          onClick={() => setShowAllocateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Allocate Points to Employee
        </button>
      </div>

      {showAllocateModal && (
        <AllocateEmployeePointsModal
          employees={deptUsers || []}
          onClose={() => setShowAllocateModal(false)}
          onSubmit={(data) => allocateMutation.mutate(data)}
          loading={allocateMutation.isPending}
          maxPoints={myDeptAllocation.remaining_budget}
          currencyCode={currencyCode}
        />
      )}

      {/* Employee Allocations */}
      <EmployeeAllocationsGrid
        allocations={employeeAllocations || []}
        employees={deptUsers || []}
        currencyCode={currencyCode}
      />
    </div>
  )
}

// ======== COMPONENTS ========

function BudgetAllocationCard({ title, total, distributed, remaining, percentage, currencyCode = 'INR' }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>
      
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4">
          <p className="text-sm text-indigo-600 font-medium mb-1">Total Allocated</p>
          <p className="text-2xl font-bold text-indigo-900">{formatDisplayValue(total, currencyCode)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <p className="text-sm text-green-600 font-medium mb-1">Distributed</p>
          <p className="text-2xl font-bold text-green-900">{formatDisplayValue(distributed, currencyCode)}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
          <p className="text-sm text-orange-600 font-medium mb-1">Remaining</p>
          <p className="text-2xl font-bold text-orange-900">{formatDisplayValue(remaining, currencyCode)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
          <p className="text-sm text-purple-600 font-medium mb-1">Utilization</p>
          <p className="text-2xl font-bold text-purple-900">{percentage}%</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}

function DepartmentAllocationsGrid({ allocations, departments, currencyCode = 'INR' }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {allocations.map((allocation) => {
        const dept = departments?.find(d => d.id === allocation.department_id)
        const utilizationPercent = ((allocation.distributed_budget / allocation.allocated_budget) * 100).toFixed(1)

        return (
          <div key={allocation.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{dept?.name || 'Unknown Department'}</h4>
                <p className="text-sm text-gray-500">ID: {allocation.id.slice(0, 8)}</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                Active
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Allocated:</span>
                <span className="font-semibold">{formatDisplayValue(allocation.allocated_budget, currencyCode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Distributed:</span>
                <span className="font-semibold text-green-600">{formatDisplayValue(allocation.distributed_budget, currencyCode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Remaining:</span>
                <span className="font-semibold text-orange-600">{formatDisplayValue(allocation.remaining_budget, currencyCode)}</span>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">{utilizationPercent}% utilized</p>

            <p className="text-xs text-gray-400 mt-4">
              Allocated on {format(new Date(allocation.allocation_date), 'MMM dd, yyyy')}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function EmployeeAllocationsGrid({ allocations, employees, currencyCode = 'INR' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Employee</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Allocated Points</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Spent</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Remaining</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Utilization</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
          </tr>
        </thead>
        <tbody>
          {allocations.map((allocation) => {
            const employee = employees?.find(e => e.id === allocation.employee_id)
            const utilizationPercent = ((allocation.spent_points / allocation.allocated_points) * 100).toFixed(1)

            return (
              <tr key={allocation.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{employee?.first_name} {employee?.last_name}</p>
                    <p className="text-sm text-gray-500">{employee?.corporate_email}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="font-semibold">{formatDisplayValue(allocation.allocated_points, currencyCode)}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-green-600 font-medium">{formatDisplayValue(allocation.spent_points, currencyCode)}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-orange-600 font-medium">{formatDisplayValue(allocation.remaining_points, currencyCode)}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">{utilizationPercent}%</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    {allocation.status}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TenantsAllocationGrid({ allocations, loading }) {
  if (loading) return <LoadingSpinner />

  if (!allocations || allocations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <HiOutlineCurrencyDollar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No tenant allocations yet</p>
            <p className="text-gray-400 text-sm">Create a new allocation to get started</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Tenant ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Total Allocated</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Distributed</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Remaining</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Utilization</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {allocations.map((alloc) => {
              const utilization = alloc.total_allocated_budget > 0 
                ? ((alloc.total_allocated_budget - alloc.remaining_balance) / alloc.total_allocated_budget * 100).toFixed(1)
                : 0
              
              return (
                <tr key={alloc.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{alloc.tenant_id}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold">
                      {formatDisplayValue(alloc.total_allocated_budget, 'INR')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
                      {formatDisplayValue(alloc.total_allocated_budget - alloc.remaining_balance, 'INR')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-semibold">
                      {formatDisplayValue(alloc.remaining_balance, 'INR')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-700 font-semibold whitespace-nowrap">{utilization}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {format(new Date(alloc.created_at), 'MMM dd, yyyy')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ======== MODALS ========

function AllocateTenantBudgetModal({ onClose, onSubmit, loading }) {
  const [formData, setFormData] = useState({
    tenant_id: '',
    total_allocated_budget: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.tenant_id || !formData.total_allocated_budget) {
      toast.error('Please fill all fields')
      return
    }
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Allocate Budget to Tenant</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tenant ID</label>
            <input
              type="text"
              value={formData.tenant_id}
              onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter tenant ID"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Total Allocated Budget</label>
            <input
              type="number"
              value={formData.total_allocated_budget}
              onChange={(e) => setFormData({ ...formData, total_allocated_budget: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter amount"
              disabled={loading}
              step="0.01"
              min="0"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Allocating...' : 'Allocate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AllocateDepartmentBudgetModal({ departments, onClose, onSubmit, loading, maxBudget, currencyCode = 'INR' }) {
  const [formData, setFormData] = useState({
    department_id: '',
    allocated_budget: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.department_id || !formData.allocated_budget) {
      toast.error('Please fill all fields')
      return
    }
    if (parseFloat(formData.allocated_budget) > maxBudget) {
      toast.error(`Budget cannot exceed available ${formatDisplayValue(maxBudget, currencyCode)}`)
      return
    }
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Allocate Budget to Department</h2>
        <p className="text-sm text-gray-600 mb-4">Available: {formatDisplayValue(maxBudget, currencyCode)}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">Select Department</option>
              {departments?.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Allocated Budget</label>
            <input
              type="number"
              value={formData.allocated_budget}
              onChange={(e) => setFormData({ ...formData, allocated_budget: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter amount"
              disabled={loading}
              step="0.01"
              min="0"
              max={maxBudget}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Allocating...' : 'Allocate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AllocateEmployeePointsModal({ employees, onClose, onSubmit, loading, maxPoints, currencyCode = 'INR' }) {
  const [formData, setFormData] = useState({
    employee_id: '',
    allocated_points: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.employee_id || !formData.allocated_points) {
      toast.error('Please fill all fields')
      return
    }
    if (parseFloat(formData.allocated_points) > maxPoints) {
      toast.error(`Points cannot exceed available ${formatDisplayValue(maxPoints, currencyCode)}`)
      return
    }
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Allocate Points to Employee</h2>
        <p className="text-sm text-gray-600 mb-4">Available: {formatDisplayValue(maxPoints, currencyCode)}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
            <select
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">Select Employee</option>
              {employees?.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.corporate_email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Allocated Points</label>
            <input
              type="number"
              value={formData.allocated_points}
              onChange={(e) => setFormData({ ...formData, allocated_points: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter points"
              disabled={loading}
              step="0.01"
              min="0"
              max={maxPoints}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Allocating...' : 'Allocate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  )
}
