import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersAPI, tenantsAPI, walletsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  HiOutlinePlus,
  HiOutlineUsers,
  HiOutlineSearch,
  HiOutlineUpload,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineRefresh,
  HiOutlineBan
} from 'react-icons/hi'

export default function Users() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkStep, setBulkStep] = useState(1)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkBatchId, setBulkBatchId] = useState(null)
  const [stagingRows, setStagingRows] = useState([])
  const [editingStagingId, setEditingStagingId] = useState(null)
  const [stagingForm, setStagingForm] = useState({
    full_name: '',
    email: '',
    department_name: '',
    role: '',
    manager_email: '',
  })
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [editingValue, setEditingValue] = useState('')
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

  const patchMutation = useMutation({
    mutationFn: ({ id, data }) => usersAPI.patch(id, data),
    onSuccess: () => {
      toast.success('User updated')
      queryClient.invalidateQueries(['users'])
      setEditingUserId(null)
      setEditingField(null)
      setEditingValue('')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update user')
    },
  })

  const bulkUploadMutation = useMutation({
    mutationFn: (file) => usersAPI.uploadBulk(file),
    onSuccess: async (response) => {
      const { batch_id } = response.data
      setBulkBatchId(batch_id)
      const staging = await usersAPI.getStaging(batch_id)
      setStagingRows(staging.data)
      setBulkStep(2)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Upload failed')
    },
  })

  const bulkConfirmMutation = useMutation({
    mutationFn: (payload) => usersAPI.confirmBulk(payload),
    onSuccess: () => {
      toast.success('Users provisioned')
      queryClient.invalidateQueries(['users'])
      setBulkStep(3)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Provisioning failed')
    },
  })

  const stagingUpdateMutation = useMutation({
    mutationFn: ({ id, data }) => usersAPI.updateStagingRow(id, data),
    onSuccess: async () => {
      if (bulkBatchId) {
        const staging = await usersAPI.getStaging(bulkBatchId)
        setStagingRows(staging.data)
      }
      toast.success('Row updated')
      setEditingStagingId(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update row')
    },
  })

  const bulkDeactivateMutation = useMutation({
    mutationFn: (payload) => usersAPI.bulkDeactivate(payload),
    onSuccess: () => {
      toast.success('Users deactivated')
      queryClient.invalidateQueries(['users'])
      setSelectedUserIds([])
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Bulk deactivate failed')
    },
  })

  const bulkReactivateMutation = useMutation({
    mutationFn: (payload) => usersAPI.bulkReactivate(payload),
    onSuccess: () => {
      toast.success('Users reactivated')
      queryClient.invalidateQueries(['users'])
      setSelectedUserIds([])
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Bulk reactivate failed')
    },
  })

  const bulkResendMutation = useMutation({
    mutationFn: (payload) => usersAPI.bulkResendInvites(payload),
    onSuccess: () => {
      toast.success('Invites resent')
      setSelectedUserIds([])
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Resend failed')
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

  const handleDownloadTemplate = async () => {
    try {
      const response = await usersAPI.downloadTemplate()
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'sparknode_user_template.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast.error('Failed to download template')
    }
  }

  const handleBulkUpload = () => {
    if (!bulkFile) {
      toast.error('Please select a file')
      return
    }
    bulkUploadMutation.mutate(bulkFile)
  }

  const handleBulkConfirm = () => {
    if (!bulkBatchId) return
    bulkConfirmMutation.mutate({ batch_id: bulkBatchId, send_invites: true })
  }

  const startEditStagingRow = (row) => {
    setEditingStagingId(row.id)
    setStagingForm({
      full_name: row.full_name || '',
      email: row.email || '',
      department_name: row.department_name || '',
      role: row.role || '',
      manager_email: row.manager_email || '',
    })
  }

  const saveStagingRow = () => {
    if (!editingStagingId) return
    stagingUpdateMutation.mutate({ id: editingStagingId, data: stagingForm })
  }

  const handleSelectUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleSelectAll = () => {
    if (!filteredUsers) return
    const allIds = filteredUsers.map((u) => u.id)
    setSelectedUserIds((prev) => (prev.length === allIds.length ? [] : allIds))
  }

  const startInlineEdit = (user, field) => {
    setEditingUserId(user.id)
    setEditingField(field)
    setEditingValue(user[field] || '')
  }

  const saveInlineEdit = () => {
    if (!editingUserId || !editingField) return
    patchMutation.mutate({ id: editingUserId, data: { [editingField]: editingValue } })
  }

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

  const getStatusBadge = (status) => {
    const normalized = (status || '').toLowerCase()
    if (normalized === 'active') return 'badge-success'
    if (normalized.includes('pending')) return 'badge-warning'
    return 'badge-error'
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowBulkModal(true)
              setBulkStep(1)
              setBulkFile(null)
              setBulkBatchId(null)
              setStagingRows([])
            }}
            className="btn-secondary flex items-center gap-2"
          >
            <HiOutlineUpload className="w-5 h-5" />
            Bulk Upload
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <HiOutlinePlus className="w-5 h-5" />
            Add User
          </button>
        </div>
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

      {/* Bulk Actions */}
      {selectedUserIds.length > 0 && (
        <div className="card flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600">
            {selectedUserIds.length} selected
          </span>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => bulkDeactivateMutation.mutate({ user_ids: selectedUserIds })}
          >
            <HiOutlineBan className="w-4 h-4" />
            Deactivate
          </button>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => bulkReactivateMutation.mutate({ user_ids: selectedUserIds })}
          >
            <HiOutlineCheckCircle className="w-4 h-4" />
            Reactivate
          </button>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => bulkResendMutation.mutate({ user_ids: selectedUserIds })}
          >
            <HiOutlineRefresh className="w-4 h-4" />
            Resend Invites
          </button>
        </div>
      )}

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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <input
                      type="checkbox"
                      checked={filteredUsers?.length > 0 && selectedUserIds.length === filteredUsers.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
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
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-sparknode-purple to-sparknode-blue flex items-center justify-center text-white font-medium text-sm">
                          {user.first_name[0]}{user.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{user.role?.replace('_', ' ')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {editingUserId === user.id && editingField === 'email' ? (
                        <div className="flex items-center gap-2">
                          <input
                            className="input"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                          />
                          <button className="btn-primary px-3 py-2" onClick={saveInlineEdit}>
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          className="text-sm text-gray-600 hover:text-sparknode-purple"
                          onClick={() => startInlineEdit(user, 'email')}
                        >
                          {user.email}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {editingUserId === user.id && editingField === 'phone_number' ? (
                        <div className="flex items-center gap-2">
                          <input
                            className="input"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                          />
                          <button className="btn-primary px-3 py-2" onClick={saveInlineEdit}>
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          className="text-sm text-gray-600 hover:text-sparknode-purple"
                          onClick={() => startInlineEdit(user, 'phone_number')}
                        >
                          {user.phone_number || user.mobile_number || '-'}
                        </button>
                      )}
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
                      <span className={`badge ${getStatusBadge(user.status)}`}>
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

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-3xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Bulk Provision Users</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowBulkModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="mb-6 flex items-center gap-3">
              <span className={`badge ${bulkStep === 1 ? 'badge-success' : 'badge-default'}`}>Upload</span>
              <span className={`badge ${bulkStep === 2 ? 'badge-success' : 'badge-default'}`}>Validate</span>
              <span className={`badge ${bulkStep === 3 ? 'badge-success' : 'badge-default'}`}>Complete</span>
            </div>

            {bulkStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center">
                      <HiOutlineUpload className="w-6 h-6 text-sparknode-purple" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mt-3">Upload CSV or XLSX</h3>
                    <p className="text-xs text-gray-500 mt-1">Drag and drop your file here or click to browse</p>
                    <label className="block mt-4">
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                      />
                      <div
                        className="inline-flex items-center justify-center btn-secondary px-4 py-2 text-sm"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          const file = e.dataTransfer.files?.[0]
                          if (file) setBulkFile(file)
                        }}
                      >
                        {bulkFile ? bulkFile.name : 'Browse Files'}
                      </div>
                    </label>
                  </div>

                  <div className="bg-purple-50 rounded-2xl p-5">
                    <h4 className="text-base font-semibold text-sparknode-purple">Instructions</h4>
                    <ul className="mt-2 space-y-1 text-xs text-purple-700 list-disc list-inside">
                      <li>Use our official CSV template for formatting</li>
                      <li>Emails must be unique within your organization</li>
                      <li>Role must be tenant_admin, tenant_lead, or corporate_user</li>
                      <li>Department names must match existing ones</li>
                    </ul>
                    <button className="btn-secondary w-full mt-4 py-2 text-sm" onClick={handleDownloadTemplate}>
                      Download Template
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-gray-400 text-center">
                  Supported formats: .CSV, .XLSX (max 10MB)
                </p>

                <div className="flex gap-3">
                  <button className="btn-secondary flex-1" onClick={() => setShowBulkModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={handleBulkUpload}
                    disabled={bulkUploadMutation.isPending}
                  >
                    {bulkUploadMutation.isPending ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            )}

            {bulkStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span>Total: {stagingRows.length}</span>
                  <span>Errors: {stagingRows.filter((r) => r.status === 'error').length}</span>
                </div>
                <div className="max-h-80 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Department</th>
                        <th className="px-3 py-2 text-left">Role</th>
                        <th className="px-3 py-2 text-left">Manager Email</th>
                        <th className="px-3 py-2 text-left">Errors</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stagingRows.map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="px-3 py-2">{row.full_name}</td>
                          <td className="px-3 py-2">{row.email}</td>
                          <td className="px-3 py-2">{row.department_name || '-'}</td>
                          <td className="px-3 py-2">{row.role || '-'}</td>
                          <td className="px-3 py-2">{row.manager_email || '-'}</td>
                          <td className="px-3 py-2">
                            {row.errors?.length ? (
                              <div className="flex items-center gap-2 text-red-600">
                                <HiOutlineXCircle className="w-4 h-4" />
                                {row.errors.join(', ')}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-green-600">
                                <HiOutlineCheckCircle className="w-4 h-4" />
                                Ready
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.errors?.length > 0 && (
                              <button
                                className="btn-secondary"
                                onClick={() => startEditStagingRow(row)}
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {editingStagingId && (
                  <div className="border rounded-lg p-4 space-y-3">
                    <h3 className="font-medium text-gray-900">Fix Row</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        className="input"
                        placeholder="Full Name"
                        value={stagingForm.full_name}
                        onChange={(e) => setStagingForm({ ...stagingForm, full_name: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Email"
                        value={stagingForm.email}
                        onChange={(e) => setStagingForm({ ...stagingForm, email: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Department"
                        value={stagingForm.department_name}
                        onChange={(e) => setStagingForm({ ...stagingForm, department_name: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Role"
                        value={stagingForm.role}
                        onChange={(e) => setStagingForm({ ...stagingForm, role: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Manager Email"
                        value={stagingForm.manager_email}
                        onChange={(e) => setStagingForm({ ...stagingForm, manager_email: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button className="btn-secondary" onClick={() => setEditingStagingId(null)}>
                        Cancel
                      </button>
                      <button
                        className="btn-primary"
                        onClick={saveStagingRow}
                        disabled={stagingUpdateMutation.isPending}
                      >
                        {stagingUpdateMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button
                    className="btn-secondary flex-1"
                    onClick={() => setBulkStep(1)}
                  >
                    Back
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={handleBulkConfirm}
                    disabled={bulkConfirmMutation.isPending}
                  >
                    {bulkConfirmMutation.isPending ? 'Provisioning...' : 'Confirm & Provision'}
                  </button>
                </div>
              </div>
            )}

            {bulkStep === 3 && (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                  <HiOutlineCheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-gray-700">Provisioning complete.</p>
                <button className="btn-primary" onClick={() => setShowBulkModal(false)}>
                  Close
                </button>
              </div>
            )}
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
