import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tenantsAPI } from '../lib/api'
import { HiOutlineOfficeBuilding, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'

export default function Departments() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingDept, setEditingDept] = useState(null)

  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => tenantsAPI.getDepartments(),
  })

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
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-600">Manage your organization's departments</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-sparknode-purple text-white rounded-lg hover:bg-sparknode-purple/90 transition-colors"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="grid gap-4">
            {departments?.data?.length > 0 ? (
              departments.data.map((dept) => (
                <div key={dept.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sparknode-purple/10 rounded-lg">
                      <HiOutlineOfficeBuilding className="w-5 h-5 text-sparknode-purple" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{dept.name}</h3>
                      <p className="text-sm text-gray-500">
                        {dept.employee_count || 0} employees
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingDept(dept)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <HiOutlinePencil className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <HiOutlineOfficeBuilding className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No departments yet</h3>
                <p className="text-gray-500 mb-4">Get started by creating your first department</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-sparknode-purple text-white rounded-lg hover:bg-sparknode-purple/90 transition-colors"
                >
                  Create Department
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}