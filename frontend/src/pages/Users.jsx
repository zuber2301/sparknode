import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersAPI, tenantsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { 
  HiOutlinePlus, 
  HiOutlinePencil, 
  HiOutlineUsers, 
  HiOutlineSearch, 
  HiOutlineUpload, 
  HiOutlineDownload, 
  HiOutlineCheckCircle, 
  HiOutlineExclamationCircle,
  HiOutlineTrash,
  HiOutlineMail,
  HiOutlineSparkles,
  HiOutlineDotsVertical,
  HiOutlineX,
  HiOutlineCloudUpload,
  HiOutlineRefresh
} from 'react-icons/hi'

export default function Users() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  
  const [uploadStep, setUploadStep] = useState('upload') // upload, preview, processing
  const [batchInfo, setBatchInfo] = useState(null)
  const [stagingData, setStagingData] = useState([])
  const [editingStagingId, setEditingStagingId] = useState(null)
  const [stagingForm, setStagingForm] = useState({})
  
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [activeDropdown, setActiveDropdown] = useState(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  const queryClient = useQueryClient()
  const { isHRAdmin } = useAuthStore()

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', { department_id: filterDepartment || undefined, status: filterStatus || undefined }],
    queryFn: () => usersAPI.getAll({ 
        department_id: filterDepartment || undefined, 
        status: filterStatus || undefined 
    }),
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => usersAPI.patch(id, data),
    onSuccess: () => {
      toast.success('User updated successfully')
      queryClient.invalidateQueries(['users'])
      setShowCreateModal(false)
      setSelectedUser(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update user')
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => usersAPI.uploadBulk(file),
    onSuccess: (res) => {
      const { batch_id, total_rows } = res.data
      setBatchInfo({ batch_id, total_rows })
      setUploadStep('preview')
      fetchStaging(batch_id)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Upload failed')
    }
  })

  const fetchStaging = async (batchId) => {
    try {
      const res = await usersAPI.getStaging(batchId)
      setStagingData(res.data)
      
      const validRows = res.data.filter(r => !r.errors?.length).length
      const invalidRows = res.data.filter(r => r.errors?.length > 0).length
      
      setBatchInfo(prev => ({ 
        ...prev, 
        valid_rows: validRows, 
        invalid_rows: invalidRows 
      }))
    } catch (err) {
      toast.error('Failed to fetch preview data')
    }
  }

  const confirmImportMutation = useMutation({
    mutationFn: (batchId) => usersAPI.confirmBulk({ batch_id: batchId, send_invites: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['users'])
      setUploadStep('processing') 
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Import failed')
    }
  })

  const stagingUpdateMutation = useMutation({
    mutationFn: ({ id, data }) => usersAPI.updateStagingRow(id, data),
    onSuccess: () => {
      if (batchInfo?.batch_id) {
        fetchStaging(batchInfo.batch_id)
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

  const handleSubmitUser = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    const payload = {
      email: formData.get('email'),
      corporate_email: formData.get('email'),
      first_name: formData.get('first_name'),
      last_name: formData.get('last_name'),
      org_role: formData.get('org_role'),
      department_id: formData.get('department_id') || null,
      personal_email: formData.get('personal_email') || null,
      mobile_number: formData.get('mobile_number') || null,
      date_of_birth: formData.get('date_of_birth') || null,
      hire_date: formData.get('hire_date') || null,
    }

    if (selectedUser) {
      updateMutation.mutate({ id: selectedUser.id, data: payload })
    } else {
      payload.password = formData.get('password')
      createMutation.mutate(payload)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      uploadMutation.mutate(file)
      e.target.value = '' 
    }
  }

  const downloadTemplate = async () => {
    try {
      const res = await usersAPI.downloadTemplate()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'sparknode_user_template.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      toast.error('Failed to download template')
    }
  }

  const toggleUserSelection = (id) => {
    if (selectedUserIds.includes(id)) {
      setSelectedUserIds(selectedUserIds.filter(userId => userId !== id))
    } else {
      setSelectedUserIds([...selectedUserIds, id])
    }
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

  const getStatusColor = (status) => {
    const s = status?.toLowerCase() || ''
    if (s === 'active') return 'badge-success'
    if (s.includes('pending')) return 'bg-yellow-100 text-yellow-800'
    if (s === 'deactivated') return 'bg-gray-100 text-gray-800'
    return 'badge-info'
  }

  const getRoleLabel = (role) => {
    if (role === 'platform_admin') return 'Platform Admin'
    if (role === 'tenant_admin') return 'Tenant Admin'
    if (role === 'tenant_lead') return 'Tenant Leader'
    if (role === 'corporate_user') return 'Corporate User'
    return role?.replace('_', ' ')
  }

  if (!isHRAdmin()) {
    return (
      <div className="card text-center py-12">
        <HiOutlineUsers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500">Only Admins can manage users.</p>
      </div>
    )
  }

  const filteredUsers = users?.data?.filter((user) =>
    `${user.first_name} ${user.last_name} ${user.email} ${user.personal_email || ''} ${user.mobile_number || ''}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  )

  const startEditStagingRow = (row) => {
    setEditingStagingId(row.id)
    setStagingForm({
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      email: row.email || '',
      corporate_email: row.corporate_email || '',
      personal_email: row.personal_email || '',
      department_name: row.department_name || '',
      org_role: row.org_role || row.role || '',
      manager_email: row.manager_email || '',
      mobile_number: row.mobile_number || '',
      date_of_birth: row.date_of_birth || '',
      hire_date: row.hire_date || '',
    })
  }

  const saveStagingRow = () => {
    if (!editingStagingId) return
    stagingUpdateMutation.mutate({ id: editingStagingId, data: stagingForm })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">Manage employee access and reporting structure</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors"
          >
            <HiOutlineUpload className="w-5 h-5" />
            Bulk Import
          </button>
          <button
            onClick={() => {
              setSelectedUser(null)
              setShowCreateModal(true)
            }}
            className="btn-primary flex items-center gap-2"
          >
            <HiOutlinePlus className="w-5 h-5" />
            Add User
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedUserIds.length > 0 && (
        <div className="bg-sparknode-purple/10 border border-sparknode-purple/20 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-sparknode-purple">{selectedUserIds.length} users selected</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => bulkResendMutation.mutate({ user_ids: selectedUserIds })}
              className="px-3 py-1.5 bg-white border border-sparknode-purple/30 rounded-lg text-sparknode-purple text-xs font-bold flex items-center gap-1.5 hover:bg-white/80"
            >
              <HiOutlineMail className="w-4 h-4" /> Resend Invites
            </button>
            <button 
              onClick={() => bulkDeactivateMutation.mutate({ user_ids: selectedUserIds })}
              className="px-3 py-1.5 bg-white border border-red-200 rounded-lg text-red-600 text-xs font-bold flex items-center gap-1.5 hover:bg-red-50"
            >
              <HiOutlineTrash className="w-4 h-4" /> Deactivate
            </button>
            <button 
              onClick={() => setSelectedUserIds([])}
              className="px-3 py-1.5 text-gray-500 text-xs font-bold hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-12 h-11"
            placeholder="Search by name, email or mobile..."
          />
        </div>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="input h-11"
        >
          <option value="">All Departments</option>
          {departments?.data?.map((dept) => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input h-11"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending_invite">Pending Invite</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </div>

      {/* Users table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300"
                    onChange={(e) => {
                       if (e.target.checked) setSelectedUserIds(filteredUsers.map(u => u.id))
                       else setSelectedUserIds([])
                    }}
                    checked={selectedUserIds.length > 0 && filteredUsers?.length > 0 && selectedUserIds.length === filteredUsers.length}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Personal Email</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Mobile Number</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="8" className="px-4 py-4 h-16 bg-gray-50/50"></td>
                  </tr>
                ))
              ) : filteredUsers?.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${selectedUserIds.includes(user.id) ? 'bg-sparknode-purple/5' : ''}`}>
                  <td className="px-4 py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-sparknode-purple focus:ring-sparknode-purple"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sparknode-purple to-sparknode-blue flex items-center justify-center text-white font-bold text-xs ring-4 ring-white shadow-sm">
                        {user.first_name[0]}{user.last_name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 truncate max-w-[150px]">
                    {user.personal_email || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {user.mobile_number || '-'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getRoleColor(user.org_role)}`}>
                      {getRoleLabel(user.org_role)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {departments?.data?.find((d) => d.id === user.department_id)?.name || '-'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`badge ${getStatusColor(user.status)}`}>
                      {user.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === user.id ? null : user.id);
                      }}
                      className="p-2 text-gray-400 hover:text-sparknode-purple hover:bg-sparknode-purple/5 rounded-lg transition-all"
                    >
                      <HiOutlineDotsVertical className="w-5 h-5" />
                    </button>

                    {activeDropdown === user.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setActiveDropdown(null)}
                        ></div>
                        <div className="absolute right-4 top-12 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                          <button 
                            onClick={() => {
                              setSelectedUser(user);
                              setShowCreateModal(true);
                              setActiveDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                          >
                            <HiOutlinePencil className="w-4 h-4 text-gray-400" />
                            Edit
                          </button>
                          
                          {user.status !== 'deactivated' ? (
                            <button 
                              onClick={() => {
                                bulkDeactivateMutation.mutate({ user_ids: [user.id] });
                                setActiveDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                            >
                              <HiOutlineTrash className="w-4 h-4 text-red-400" />
                              Deactivate
                            </button>
                          ) : (
                            <button 
                              onClick={() => {
                                // Add reactivate if path exists
                                setActiveDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2 transition-colors"
                            >
                              <HiOutlineCheckCircle className="w-4 h-4 text-green-400" />
                              Reactivate
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {!isLoading && filteredUsers?.length === 0 && (
          <div className="text-center py-12">
            <HiOutlineUsers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No users found matching your criteria</p>
          </div>
        )}
      </div>

      {/* Bulk Upload Modal (Wizard) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <HiOutlineUpload className="w-6 h-6 text-sparknode-purple" />
                Bulk User Provisioning
              </h2>
              <button onClick={() => { setShowUploadModal(false); setUploadStep('upload'); }} className="text-gray-400 hover:text-gray-600">
                <HiOutlineX className="w-6 h-6" />
              </button>
            </div>

            {/* Stepper */}
            <div className="bg-gray-50/50 border-b border-gray-100 px-8 py-4">
              <div className="flex items-center justify-between max-w-2xl mx-auto relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -translate-y-1/2 z-0"></div>
                <div 
                  className="absolute top-1/2 left-0 h-0.5 bg-sparknode-purple -translate-y-1/2 z-0 transition-all duration-500"
                  style={{ width: uploadStep === 'upload' ? '0%' : uploadStep === 'preview' ? '50%' : '100%' }}
                ></div>

                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${uploadStep === 'upload' ? 'bg-sparknode-purple text-white' : 'bg-green-500 text-white'}`}>
                    {uploadStep !== 'upload' ? '✓' : '1'}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${uploadStep === 'upload' ? 'text-sparknode-purple' : 'text-gray-400'}`}>Upload</span>
                </div>

                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${uploadStep === 'preview' ? 'bg-sparknode-purple text-white shadow-lg shadow-sparknode-purple/20' : uploadStep === 'upload' ? 'bg-white border-2 border-gray-200 text-gray-400' : 'bg-green-500 text-white'}`}>
                    {uploadStep === 'processing' ? '✓' : '2'}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${uploadStep === 'preview' ? 'text-sparknode-purple' : 'text-gray-400'}`}>Preview</span>
                </div>

                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${uploadStep === 'processing' ? 'bg-sparknode-purple text-white' : 'bg-white border-2 border-gray-200 text-gray-400'}`}>
                    3
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${uploadStep === 'processing' ? 'text-sparknode-purple' : 'text-gray-400'}`}>Complete</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {uploadStep === 'upload' && (
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50 hover:bg-gray-100 hover:border-sparknode-purple/30 transition-all cursor-pointer group relative">
                      <input 
                        type="file" 
                        accept=".csv,.xlsx" 
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleFileUpload}
                      />
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                        {uploadMutation.isPending ? (
                          <div className="w-6 h-6 border-2 border-sparknode-purple border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <HiOutlineUpload className="w-6 h-6 text-sparknode-purple" />
                        )}
                      </div>
                      <p className="font-bold text-sm text-gray-900 mb-0.5">Upload CSV or XLSX</p>
                      <p className="text-[10px] text-gray-500 text-center">Drag and drop your file here</p>
                    </div>

                    <div className="flex flex-col justify-center space-y-3">
                      <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl">
                        <h3 className="font-bold text-xs text-sparknode-purple mb-1.5 flex items-center gap-1.5">
                          <HiOutlineExclamationCircle className="w-4 h-4" /> Instructions
                        </h3>
                        <ul className="text-[10px] space-y-1 text-sparknode-purple/80">
                          <li>• Use our official CSV template for formatting</li>
                          <li>• Emails must be unique within your organization</li>
                          <li>• Role must be 'corporate_user', 'tenant_lead' or 'tenant_admin'</li>
                          <li>• Mobile should follow international format if possible</li>
                        </ul>
                      </div>
                      <button 
                        onClick={downloadTemplate}
                        className="flex items-center justify-center gap-2 w-full py-2.5 border border-sparknode-purple/20 text-sparknode-purple rounded-xl text-sm font-bold hover:bg-sparknode-purple/5 transition-all"
                      >
                        <HiOutlineDownload className="w-4 h-4" />
                        Download Template
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {uploadStep === 'preview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 border border-green-100 rounded-2xl">
                       <p className="text-xs text-green-600 font-bold uppercase">Ready to Import</p>
                       <p className="text-2xl font-bold text-green-700">{batchInfo?.valid_rows}</p>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                       <p className="text-xs text-red-600 font-bold uppercase">Errors Detected</p>
                       <p className="text-2xl font-bold text-red-700">{batchInfo?.invalid_rows}</p>
                    </div>
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                       <p className="text-xs text-gray-500 font-bold uppercase">Total Rows</p>
                       <p className="text-2xl font-bold text-gray-700">{batchInfo?.total_rows}</p>
                    </div>
                  </div>

                  <div className="border rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-bold text-gray-400 text-[10px] uppercase">Recipient</th>
                          <th className="px-4 py-3 text-left font-bold text-gray-400 text-[10px] uppercase">Attributes</th>
                          <th className="px-4 py-3 text-left font-bold text-gray-400 text-[10px] uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {stagingData.map((row) => (
                          <tr key={row.id} className={!row.errors?.length ? 'bg-white' : 'bg-red-50/50'}>
                             <td className="px-4 py-3">
                                <p className="font-bold text-gray-900">{row.first_name} {row.last_name}</p>
                                <p className="text-xs text-gray-500">{row.corporate_email || row.email}</p>
                                <div className="mt-1 flex gap-2">
                                  {row.personal_email && <span className="text-[10px] text-gray-400">P: {row.personal_email}</span>}
                                  {row.mobile_number && <span className="text-[10px] text-gray-400">M: {row.mobile_number}</span>}
                                </div>
                             </td>
                             <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600 font-medium uppercase">{row.org_role || row.role}</span>
                                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600 font-medium uppercase">{row.department_name}</span>
                                </div>
                             </td>
                             <td className="px-4 py-3 text-right">
                                {!row.errors?.length ? (
                                  <div className="flex items-center justify-end gap-1.5 text-green-600 text-xs font-bold uppercase">
                                    <HiOutlineCheckCircle className="w-4 h-4" /> Valid
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="text-red-500 text-[10px] font-bold uppercase">
                                      {row.errors.map((err, i) => (
                                        <p key={i} className="flex items-center justify-end gap-1">
                                          <HiOutlineExclamationCircle className="w-3 h-3" /> {err}
                                        </p>
                                      ))}
                                    </div>
                                    <button 
                                      onClick={() => startEditStagingRow(row)}
                                      className="text-[9px] font-bold text-sparknode-purple hover:underline"
                                    >
                                      Edit Details
                                    </button>
                                  </div>
                                )}
                             </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {editingStagingId && (
                    <div className="bg-[#1e293b] rounded-3xl p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white">Modify Record</h3>
                        <button onClick={() => setEditingStagingId(null)} className="text-gray-400 hover:text-white">
                          <HiOutlineX className="w-6 h-6" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {['first_name', 'last_name', 'email', 'corporate_email', 'department_name', 'org_role', 'mobile_number', 'manager_email'].map(field => (
                          <div key={field}>
                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1 mb-1 block tracking-widest">{field.replace('_', ' ')}</label>
                            <input
                              className="w-full bg-[#334155] border-none rounded-xl text-sm text-white focus:ring-2 focus:ring-sparknode-purple placeholder-gray-500 py-2 px-3"
                              value={stagingForm[field] || ''}
                              onChange={(e) => setStagingForm({ ...stagingForm, [field]: e.target.value })}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-4 pt-4">
                        <button className="text-sm font-bold text-gray-400 hover:text-white" onClick={() => setEditingStagingId(null)}>Discard</button>
                        <button 
                          onClick={saveStagingRow}
                          className="px-8 py-2.5 bg-sparknode-purple text-white rounded-xl text-sm font-bold hover:bg-purple-600 transition-colors shadow-lg shadow-purple-500/20"
                        >
                          {stagingUpdateMutation.isPending ? 'Saving...' : 'Update & Re-validate'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {uploadStep === 'processing' && (
                <div className="py-12 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <HiOutlineCheckCircle className="w-12 h-12 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Import Successful!</h3>
                  <p className="text-gray-500 max-w-sm mb-8">
                    Your employees have been provisioned and welcome invitations are being sent.
                  </p>
                  <button 
                    onClick={() => {
                        setShowUploadModal(false);
                        setUploadStep('upload');
                    }}
                    className="btn-primary px-10 py-3 rounded-2xl shadow-xl shadow-sparknode-purple/20"
                  >
                    Go back to Users
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              {uploadStep === 'preview' ? (
                <>
                  <button 
                    onClick={() => {
                      setUploadStep('upload')
                      setBatchInfo(null)
                      setStagingData([])
                    }}
                    className="px-6 py-2.5 font-bold text-gray-500 hover:text-gray-700"
                  >
                    Discard & Retry
                  </button>
                  <button 
                    onClick={() => confirmImportMutation.mutate(batchInfo?.batch_id)}
                    disabled={batchInfo?.valid_rows === 0 || confirmImportMutation.isPending}
                    className="btn-primary px-8 py-2.5 shadow-lg shadow-sparknode-purple/20 flex items-center gap-2"
                  >
                    {confirmImportMutation.isPending ? 'Processing...' : `Provision ${batchInfo?.valid_rows} Users`}
                  </button>
                </>
              ) : (
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-400 font-medium">Supported formats: .CSV, .XLSX (max 10MB)</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Update/Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedUser ? 'Edit Employee Details' : 'New Employee Setup'}
              </h2>
              <button 
                onClick={() => { setShowCreateModal(false); setSelectedUser(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <HiOutlineX className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input name="first_name" className="input" defaultValue={selectedUser?.first_name} placeholder="John" required />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input name="last_name" className="input" defaultValue={selectedUser?.last_name} placeholder="Doe" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Work Email</label>
                  <input name="email" type="email" className="input" defaultValue={selectedUser?.email} placeholder="john@sparknode.com" required />
                </div>
                <div>
                  <label className="label">Personal Email</label>
                  <input name="personal_email" type="email" className="input" defaultValue={selectedUser?.personal_email} placeholder="personal@email.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Mobile Number</label>
                  <div className="flex gap-0 ring-1 ring-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sparknode-purple transition-all h-11">
                    <div className="bg-gray-50 border-r border-gray-100 flex items-center px-3">
                      <select name="country_code" className="bg-transparent border-none focus:ring-0 text-sm font-medium cursor-pointer" defaultValue="+91">
                        <option value="+91">🇮🇳 +91</option>
                      </select>
                    </div>
                    <input 
                      name="mobile_number" 
                      className="flex-1 border-none focus:ring-0 text-sm px-4" 
                      defaultValue={selectedUser?.mobile_number ? selectedUser.mobile_number.replace(/^\+91/, '') : ''}
                      placeholder="10 digit number" 
                      maxLength="10"
                      onKeyPress={(e) => !/[0-9]/.test(e.key) && e.preventDefault()}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Org Role</label>
                  <select name="org_role" className="input" defaultValue={selectedUser?.org_role || 'corporate_user'} required>
                    <option value="corporate_user">Employee</option>
                    <option value="tenant_lead">Manager</option>
                    <option value="tenant_admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Department</label>
                  <select name="department_id" className="input" defaultValue={selectedUser?.department_id || ''} required>
                    <option value="">Select department</option>
                    {departments?.data?.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                {!selectedUser ? (
                  <div>
                    <label className="label">Initial Password</label>
                    <input name="password" type="password" className="input" placeholder="••••••••" required />
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest text-center">Password cannot be edited here for security</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                <div>
                  <label className="label text-[10px] uppercase font-bold text-gray-400">Date of Birth</label>
                  <input name="date_of_birth" type="date" className="input" defaultValue={selectedUser?.date_of_birth} />
                </div>
                <div>
                  <label className="label text-[10px] uppercase font-bold text-gray-400">Hire Date</label>
                  <input name="hire_date" type="date" className="input" defaultValue={selectedUser?.hire_date} />
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => { setShowCreateModal(false); setSelectedUser(null); }}
                  className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 btn-primary py-3 rounded-2xl shadow-lg shadow-sparknode-purple/20"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (selectedUser ? 'Save Changes' : 'Create & Send Invite')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
