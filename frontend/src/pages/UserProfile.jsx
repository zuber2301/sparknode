import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { usersAPI, walletsAPI, recognitionAPI } from '../lib/api'
import { HiOutlineUser, HiOutlineMail, HiOutlineBriefcase, HiOutlinePhone, HiOutlineOfficeBuilding, HiOutlineCalendar, HiOutlineArrowLeft } from 'react-icons/hi'
import { formatRoleLabel } from '../utils/userUtils'
import toast from 'react-hot-toast'

export default function UserProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: currentUser, getEffectiveRole } = useAuthStore()
  const effectiveRole = getEffectiveRole()

  // Check if user has permission to view this profile
  const canViewProfile = () => {
    if (!currentUser || !userId) return false

    // Platform admins can view all profiles
    if (effectiveRole === 'platform_admin') return true

    // Users can view their own profile
    if (currentUser.id === userId) return true

    // Tenant managers can view users in their tenant
    if (['tenant_manager'].includes(effectiveRole)) {
      // We'll check this in the API response
      return true
    }

    return false
  }

  const { data: user, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersAPI.getUser(userId),
    enabled: !!userId && canViewProfile(),
  })

  const { data: wallet } = useQuery({
    queryKey: ['userWallet', userId],
    queryFn: () => walletsAPI.getUserWallet(userId),
    enabled: !!userId && canViewProfile(),
  })

  const { data: stats } = useQuery({
    queryKey: ['userRecognitionStats', userId],
    queryFn: () => recognitionAPI.getUserStats(userId),
    enabled: !!userId && canViewProfile(),
  })

  if (!canViewProfile()) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-red-500 text-lg font-semibold">Access Denied</div>
        <p className="text-gray-500 mt-2">You don't have permission to view this user's profile.</p>
        <button
          onClick={() => navigate('/users')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Back to Users
        </button>
      </div>
    )
  }

  if (userLoading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500">Loading user profile...</p>
      </div>
    )
  }

  if (userError || !user) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-red-500 text-lg font-semibold">User Not Found</div>
        <p className="text-gray-500 mt-2">The requested user could not be found or you don't have access.</p>
        <button
          onClick={() => navigate('/users')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Back to Users
        </button>
      </div>
    )
  }

  const getInitials = () => {
    if (user.first_name || user.last_name) {
      const a = user.first_name?.[0] || ''
      const b = user.last_name?.[0] || ''
      return (a + b).toUpperCase()
    }
    return 'U'
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/users')}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md"
        >
          <HiOutlineArrowLeft className="w-5 h-5" />
          Back to Users
        </button>
      </div>

      {/* Profile Header */}
      <div className="card text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-sparknode-purple to-sparknode-blue flex items-center justify-center text-white text-3xl font-bold mb-4">
          {getInitials()}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {user.first_name} {user.last_name}
        </h1>
        <p className="text-gray-500">{formatRoleLabel(user.org_role)}</p>
        <p className="text-sm text-gray-400 mt-1">ID: {user.id}</p>
      </div>

      {/* Basic Information */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <HiOutlineUser className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">First Name</p>
              <p className="font-medium">{user.first_name || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <HiOutlineUser className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Name</p>
              <p className="font-medium">{user.last_name || 'Not specified'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlineMail className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Corporate Email</p>
              <p className="font-medium">{user.corporate_email || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlineMail className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Personal Email</p>
              <p className="font-medium">{user.personal_email || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlinePhone className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Phone Number</p>
              <p className="font-medium">{user.phone_number || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlinePhone className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Mobile Number</p>
              <p className="font-medium">{user.mobile_number || 'Not specified'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Employment Information */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Employment Information</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <HiOutlineCalendar className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Date of Joining</p>
              <p className="font-medium">{formatDate(user.hire_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <HiOutlineBriefcase className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <p className="font-medium">{formatRoleLabel(user.org_role)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <HiOutlineOfficeBuilding className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Department</p>
              <p className="font-medium">{user.department_name || 'Not assigned'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <HiOutlineUser className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium capitalize">{user.status || 'Unknown'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Points & Recognition Stats */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Points & Recognition</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-500">Current Balance</p>
            <p className="text-xl font-bold text-sparknode-purple">{wallet?.data?.balance || 0}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-500">Lifetime Earned</p>
            <p className="text-xl font-bold text-green-600">{wallet?.data?.lifetime_earned || 0}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-500">Recognitions Given</p>
            <p className="text-xl font-bold text-blue-600">{stats?.data?.total_given || 0}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-500">Recognitions Received</p>
            <p className="text-xl font-bold text-orange-600">{stats?.data?.total_received || 0}</p>
          </div>
        </div>
      </div>

      {/* Top Badges */}
      {stats?.data?.top_badges?.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Top Recognition Badges</h2>
          <div className="space-y-2">
            {stats.data.top_badges.map((badge, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-sparknode-orange to-sparknode-pink flex items-center justify-center text-white text-xs font-bold">
                    {index + 1}
                  </div>
                  <span className="font-medium text-sm">{badge.name}</span>
                </div>
                <span className="text-gray-500 text-sm">{badge.count}x received</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}