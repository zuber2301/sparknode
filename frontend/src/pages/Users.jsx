import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersAPI, tenantsAPI, walletsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineUsers, HiOutlineSearch } from 'react-icons/hi'

export default function Users() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const queryClient = useQueryClient()
  const { isHRAdmin } = useAuthStore()

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', { department_id: filterDepartment || undefined }],
    queryFn: () => usersAPI.getAll({ department_id: filterDepartment || undefined }),
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => tenantsAPI.getDepartments(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => usersAPI.create(data),
    onSuccess: () => {
      toast.success('User created successfully')
      queryClient.invalidateQueries(['users'])
      setShowCreateModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create user')
    },
  })

  const allocateMutation = useMutation({
    mutationFn: (data) => walletsAPI.allocatePoints(data),
    onSuccess: () => {
      toast.success('Points allocated successfully')
      setShowAllocateModal(false)
      setSelectedUser(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to allocate points')
    },
  })

  const handleCreateUser = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    createMutation.mutate({
      email: formData.get('email'),
      password: formData.get('password'),
      first_name: formData.get('first_name'),
      last_name: formData.get('last_name'),
      role: formData.get('role'),
      department_id: formData.get('department_id') || null,
    })
  }

  const handleAllocatePoints = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    allocateMutation.mutate({
      user_id: selectedUser.id,
      points: parseFloat(formData.get('points')),
      description: formData.get('description'),
    })
  }

  const filteredUsers = users?.data?.filter((user) =>
    `${user.first_name} ${user.last_name} ${user.email}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  )

  const getRoleLabel = (role) => {
    if (role === 'platform_admin') return 'Perksu Admin'
    return role?.replace('_', ' ')
  }

  const getRoleColor = (role) => {
    const colors = {
      platform_admin: 'bg-red-100 text-red-800',
      tenant_admin: 'bg-purple-100 text-purple-800',
      tenant_lead: 'bg-blue-100 text-blue-800',
      corporate_user: 'bg-green-100 text-green-800',
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  if (!isHRAdmin()) {
    return (
      <div className="card text-center py-12">
        <HiOutlineUsers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500">Only Tenant Admins can manage users.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-12"
            placeholder="Search users..."
          />
        </div>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="input md:w-48"
        >
          <option value="">All Departments</option>
          {departments?.data?.map((dept) => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
      </div>

      {/* Users table */}
      {isLoading ? (
        <div className="card">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers?.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-sparknode-purple to-sparknode-blue flex items-center justify-center text-white font-medium text-sm">
                          {user.first_name[0]}{user.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge ${getRoleColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {departments?.data?.find((d) => d.id === user.department_id)?.name || '-'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge ${
                        user.status === 'active' ? 'badge-success' : 'badge-error'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedUser(user)
                          setShowAllocateModal(true)
                        }}
                        className="text-sparknode-purple hover:text-sparknode-purple/80 font-medium text-sm"
                      >
                        Allocate Points
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredUsers?.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No users found
            </div>
          )}
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Add New User</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input name="first_name" className="input" required />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input name="last_name" className="input" required />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input name="email" type="email" className="input" required />
              </div>
              <div>
                <label className="label">Password</label>
                <input name="password" type="password" className="input" required />
              </div>
              <div>
                <label className="label">Role</label>
                <select name="role" className="input" required>
                  <option value="corporate_user">Corporate User</option>
                  <option value="tenant_lead">Tenant Lead</option>
                  <option value="tenant_admin">Tenant Admin</option>
                </select>
              </div>
              <div>
                <label className="label">Department</label>
                <select name="department_id" className="input">
                  <option value="">Select department</option>
                  {departments?.data?.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
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

      {/* Allocate Points Modal */}
      {showAllocateModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-2">Allocate Points</h2>
            <p className="text-gray-500 mb-4">
              To: {selectedUser.first_name} {selectedUser.last_name}
            </p>
            <form onSubmit={handleAllocatePoints} className="space-y-4">
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
                  placeholder="e.g., Monthly allocation"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAllocateModal(false)
                    setSelectedUser(null)
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
