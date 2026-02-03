import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { walletsAPI, recognitionAPI } from '../lib/api'
import { HiOutlineUser, HiOutlineMail, HiOutlineBriefcase, HiOutlinePhone, HiOutlineOfficeBuilding } from 'react-icons/hi'

export default function Profile() {
  const { user, tenantContext } = useAuthStore()

  const { data: wallet } = useQuery({
    queryKey: ['myWallet'],
    queryFn: () => walletsAPI.getMyWallet(),
  })

  const { data: stats } = useQuery({
    queryKey: ['myRecognitionStats'],
    queryFn: () => recognitionAPI.getMyStats(),
  })

  const getRoleDisplayName = (role) => {
    const roles = {
      'platform_admin': 'Platform Admin',
      'tenant_manager': 'Tenant Manager',
      'tenant_lead': 'Tenant Leader',
      'corporate_user': 'Corporate User'
    };
    return roles[role] || (role ? role.replace('_', ' ') : 'Employee');
  };

  const formatLocalPart = (local) => {
    if (!local) return ''
    return local
      .split(/[_\.\-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  const getDisplayName = () => {
    if (user?.first_name) return user.first_name
    const local = user?.email?.split('@')[0]
    return formatLocalPart(local) || 'User'
  }

  const getInitials = () => {
    if (user?.first_name || user?.last_name) {
      const a = user?.first_name?.[0] || ''
      const b = user?.last_name?.[0] || ''
      return (a + b).toUpperCase()
    }
    const parts = getDisplayName().split(' ').filter(Boolean)
    return (parts[0]?.[0] || 'U') + (parts[1]?.[0] || '')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="card text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-sparknode-purple to-sparknode-blue flex items-center justify-center text-white text-3xl font-bold mb-4">
          {getInitials()}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{getDisplayName()}</h1>
        <p className="text-gray-500">{getRoleDisplayName(user?.org_role)}</p>
      </div>

      {/* Contact Info */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlineMail className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlinePhone className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="font-medium">{user?.phone_number || 'Not provided'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlineBriefcase className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <p className="font-medium">{getRoleDisplayName(user?.org_role)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlineUser className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium capitalize">{user?.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlineOfficeBuilding className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tenant Name</p>
              <p className="font-medium">{tenantContext?.tenant_name || user?.tenant_name || 'Not assigned'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlineBriefcase className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tenant ID</p>
              <p className="font-medium text-xs break-all">{tenantContext?.tenant_id || user?.tenant_id || 'Not assigned'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recognition Stats</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Points Balance</p>
            <p className="text-2xl font-bold text-sparknode-purple">{wallet?.data?.balance || 0}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Lifetime Earned</p>
            <p className="text-2xl font-bold text-green-600">{wallet?.data?.lifetime_earned || 0}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Recognitions Given</p>
            <p className="text-2xl font-bold text-blue-600">{stats?.data?.total_given || 0}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Recognitions Received</p>
            <p className="text-2xl font-bold text-orange-600">{stats?.data?.total_received || 0}</p>
          </div>
        </div>
      </div>

      {/* Top Badges */}
      {stats?.data?.top_badges?.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Top Badges</h2>
          <div className="space-y-3">
            {stats.data.top_badges.map((badge, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-sparknode-orange to-sparknode-pink flex items-center justify-center text-white text-sm font-bold">
                    {index + 1}
                  </div>
                  <span className="font-medium">{badge.name}</span>
                </div>
                <span className="text-gray-500">{badge.count}x received</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
