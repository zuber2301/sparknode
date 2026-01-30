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
  HiOutlineExclamationCircle,
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
    first_name: '',
    last_name: '',
    email: '',
    corporate_email: '',
    personal_email: '',
    department_name: '',
    org_role: '',
    manager_email: '',
    phone_number: '',
    mobile_number: '',
    date_of_birth: '',
    hire_date: '',
  })
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

  const handleCreateUser = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    createMutation.mutate({
      email: formData.get('corporate_email'),
      corporate_email: formData.get('corporate_email'),
      personal_email: formData.get('personal_email'),
      mobile_number: formData.get('mobile_number'),
      password: formData.get('password'),
      first_name: formData.get('first_name'),
      last_name: formData.get('last_name'),
      org_role: formData.get('org_role'),
      department_id: formData.get('department_id') || null,
      date_of_birth: formData.get('date_of_birth') || null,
      hire_date: formData.get('hire_date') || null,
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
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      email: row.email || '',
      corporate_email: row.corporate_email || '',
      personal_email: row.personal_email || '',
      department_name: row.department_name || '',
      role: row.role || '',
      manager_email: row.manager_email || '',
      phone_number: row.phone_number || '',
      mobile_number: row.mobile_number || '',
      date_of_birth: row.date_of_birth || '',
      hire_date: row.hire_date || '',
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
                          <p className="text-sm text-gray-500">{user.org_role?.replace('_', ' ')}</p>
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
                      <span className={`badge ${getRoleColor(user.org_role)}`}>
                        {getRoleLabel(user.org_role)}
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
                      {/* Actions can be added here if needed */}
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
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">New Employee Setup</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <span className="text-2xl">×</span>
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input name="first_name" className="input" placeholder="John" required />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input name="last_name" className="input" placeholder="Doe" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Work Email</label>
                  <input name="corporate_email" type="email" className="input" placeholder="john@perksu.com" required />
                  {/* Keep email hidden or same as corporate_email for legacy compatibility if needed, 
                      but for now we map corporate_email as the primary identifier if email is not provided separately */}
                  <input name="email" type="hidden" value={stagingForm.corporate_email} />
                </div>
                <div>
                  <label className="label">Personal Email</label>
                  <input name="personal_email" type="email" className="input" placeholder="personal@email.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Mobile Number</label>
                  <input name="mobile_number" className="input" placeholder="+91 XXXXX XXXXX" />
                </div>
                <div>
                  <label className="label">Org Role</label>
                  <select name="org_role" className="input" required>
                    <option value="corporate_user">Employee</option>
                    <option value="tenant_lead">Manager / Team Lead</option>
                    <option value="tenant_admin">HR / Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Department</label>
                  <select name="department_id" className="input">
                    <option value="">Select department</option>
                    {departments?.data?.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Initial Password</label>
                  <input name="password" type="password" className="input" placeholder="••••••••" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label text-[10px] uppercase font-bold text-gray-400">Date of Birth</label>
                  <input name="date_of_birth" type="date" className="input" />
                </div>
                <div>
                  <label className="label text-[10px] uppercase font-bold text-gray-400">Hire Date</label>
                  <input name="hire_date" type="date" className="input" />
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1 py-3 text-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1 py-3 text-lg font-semibold bg-indigo-600 hover:bg-indigo-700"
                >
                  {createMutation.isPending ? 'Processing...' : 'Create & Send Invite'}
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Bulk Provision Users</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowBulkModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-gray-400">
                <span className={bulkStep >= 1 ? 'text-indigo-600' : ''}>UPLOAD</span>
                <span className={bulkStep >= 2 ? 'text-indigo-600' : ''}>PREVIEW</span>
                <span className={bulkStep >= 3 ? 'text-indigo-600' : ''}>COMPLETE</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                  style={{ width: `${(bulkStep / 3) * 100}%` }}
                />
              </div>
            </div>

            {bulkStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center">
                      <HiOutlineUpload className="w-6 h-6 text-sparknode-purple" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mt-2">Upload CSV or XLSX</h3>
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

                  <div className="bg-purple-50 rounded-2xl p-4">
                    <h4 className="text-base font-semibold text-sparknode-purple">Instructions</h4>
                    <ul className="mt-2 space-y-1 text-xs text-purple-700 list-disc list-inside">
                      <li>Use our official CSV template for formatting</li>
                      <li>Emails must be unique within your organization</li>
                      <li>Role must be tenant_admin, tenant_lead, or corporate_user</li>
                      <li>Department names must match existing ones</li>
                    </ul>
                    <button className="btn-secondary w-full mt-3 py-2 text-sm" onClick={handleDownloadTemplate}>
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
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-tight">Ready to Import</div>
                    <div className="text-xl font-bold text-blue-700">{stagingRows.filter((r) => !r.errors?.length).length}</div>
                  </div>
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                    <div className="text-[10px] font-bold text-orange-500 uppercase tracking-tight">Errors Detected</div>
                    <div className="text-xl font-bold text-orange-700">{stagingRows.filter((r) => r.errors?.length > 0).length}</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Total Rows</div>
                    <div className="text-xl font-bold text-gray-700">{stagingRows.length}</div>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Recipient</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Attributes</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stagingRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{row.first_name} {row.last_name}</div>
                            <div className="text-[11px] text-gray-500 flex flex-col mt-0.5">
                              <span>Work: {row.corporate_email || row.email}</span>
                              {row.personal_email && <span>Personal: {row.personal_email}</span>}
                              {row.mobile_number && <span>Mobile: {row.mobile_number}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase whitespace-nowrap">
                                {row.org_role?.replace('_', ' ') || 'EMPLOYEE'}
                              </span>
                              {row.department_name && (
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase whitespace-nowrap">
                                  {row.department_name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {row.errors?.length ? (
                              <div className="flex items-start gap-2 text-red-600">
                                <HiOutlineExclamationCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div className="text-[11px] font-medium leading-relaxed">
                                  {row.errors.map((err, idx) => (
                                    <div key={idx}>{err}</div>
                                  ))}
                                  <button 
                                    className="mt-1 text-indigo-600 hover:text-indigo-800 font-bold uppercase cursor-pointer block"
                                    onClick={() => startEditStagingRow(row)}
                                  >
                                    Edit Row
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-green-600">
                                <HiOutlineCheckCircle className="w-4 h-4 flex-shrink-0" />
                                <span className="text-[11px] font-bold uppercase">Ready</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {editingStagingId && (
                  <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                    <h3 className="font-medium text-gray-900">Fix Row</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      <input
                        className="input"
                        placeholder="First Name"
                        value={stagingForm.first_name}
                        onChange={(e) => setStagingForm({ ...stagingForm, first_name: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Last Name"
                        value={stagingForm.last_name}
                        onChange={(e) => setStagingForm({ ...stagingForm, last_name: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Email"
                        value={stagingForm.email}
                        onChange={(e) => setStagingForm({ ...stagingForm, email: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Corporate Email"
                        value={stagingForm.corporate_email}
                        onChange={(e) => setStagingForm({ ...stagingForm, corporate_email: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Personal Email"
                        value={stagingForm.personal_email}
                        onChange={(e) => setStagingForm({ ...stagingForm, personal_email: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Department"
                        value={stagingForm.department_name}
                        onChange={(e) => setStagingForm({ ...stagingForm, department_name: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Org Role"
                        value={stagingForm.org_role}
                        onChange={(e) => setStagingForm({ ...stagingForm, org_role: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Manager Email"
                        value={stagingForm.manager_email}
                        onChange={(e) => setStagingForm({ ...stagingForm, manager_email: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Phone Number"
                        value={stagingForm.phone_number}
                        onChange={(e) => setStagingForm({ ...stagingForm, phone_number: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Mobile Number"
                        value={stagingForm.mobile_number}
                        onChange={(e) => setStagingForm({ ...stagingForm, mobile_number: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="DOB (YYYY-MM-DD)"
                        value={stagingForm.date_of_birth}
                        onChange={(e) => setStagingForm({ ...stagingForm, date_of_birth: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Hire Date (YYYY-MM-DD)"
                        value={stagingForm.hire_date}
                        onChange={(e) => setStagingForm({ ...stagingForm, hire_date: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button className="btn-secondary" onClick={() => setEditingStagingId(null)}>
                        Cancel
                      </button>
                      <button
                        className="btn-primary bg-indigo-600"
                        onClick={saveStagingRow}
                        disabled={stagingUpdateMutation.isPending}
                      >
                        {stagingUpdateMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex gap-4 pt-4">
                  <button
                    className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-xs hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      setBulkFile(null)
                      setBulkStep(1)
                      setStagingRows([])
                    }}
                  >
                    Discard & Retry
                  </button>
                  <button
                    className="flex-[2] py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold uppercase tracking-wider text-xs hover:bg-indigo-700 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
                    onClick={handleBulkConfirm}
                    disabled={bulkConfirmMutation.isPending || stagingRows.filter(r => !r.errors?.length).length === 0}
                  >
                    {bulkConfirmMutation.isPending ? 'Provisioning...' : `Provision ${stagingRows.filter(r => !r.errors?.length).length} Users`}
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
    </div>
  )
}
