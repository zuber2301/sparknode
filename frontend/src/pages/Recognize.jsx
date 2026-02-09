import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { recognitionAPI, usersAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useSearchParams } from 'react-router-dom'
import { HiOutlineSearch, HiOutlineSparkles, HiOutlineStar, HiOutlineUsers } from 'react-icons/hi'
import RecognitionModal from '../components/RecognitionModal'
import FeedCard from '../components/FeedCard'

export default function Recognize() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [defaultType, setDefaultType] = useState('standard')
  const { user, getEffectiveRole } = useAuthStore()
  const effectiveRole = getEffectiveRole()
  const [searchParams, setSearchParams] = useSearchParams()

  const isManager = ['tenant_manager', 'dept_lead', 'dept_lead', 'platform_admin'].includes(effectiveRole);

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['userSearch', searchQuery],
    queryFn: () => usersAPI.search(searchQuery),
    enabled: searchQuery.length >= 2,
  })

  const { data: recentRecognitions } = useQuery({
    queryKey: ['recognitions', { user_id: user?.id }],
    queryFn: () => recognitionAPI.getAll({ limit: 10 }),
  })

  const handleSelectUser = (user) => {
    setSelectedUser(user)
    setDefaultType('standard')
    setShowModal(true)
  }

  const handleOpenWorkflow = (type) => {
    setDefaultType(type)
    setSelectedUser(null)
    setShowModal(true)
  }

  const pathways = [
    { 
      id: 'individual_award', 
      name: 'Individual Award', 
      description: 'Manager-to-employee high impact recognition', 
      icon: HiOutlineSparkles, 
      color: 'orange', 
      roles: ['dept_lead', 'dept_lead', 'tenant_manager', 'platform_admin'] 
    },
    { 
      id: 'group_award', 
      name: 'Group Award', 
      description: 'Celebrate team-wide wins and project milestones', 
      icon: HiOutlineUsers, 
      color: 'blue', 
      roles: ['dept_lead', 'dept_lead', 'tenant_manager', 'platform_admin'] 
    },
    { 
      id: 'ecard', 
      name: 'Send E-Card', 
      description: 'Personalized cards for birthdays and milestones', 
      icon: HiOutlineStar, 
      color: 'purple' 
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 text-gray-900 leading-normal">
      <RecognitionModal 
        isOpen={showModal} 
        onClose={() => {
          setShowModal(false)
          setSelectedUser(null)
          setDefaultType('standard')
        }}
        initialSelectedUser={selectedUser}
        defaultType={defaultType}
      />
      
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mb-4 shadow-lg">
          <HiOutlineSparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Recognize Someone</h1>
        <p className="text-gray-500">
          Show appreciation for your colleagues' great work and build a culture of gratitude.
        </p>
      </div>

      {/* Pathways */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pathways.map(path => (
          (!path.roles || path.roles.includes(user?.org_role)) && (
            <button
              key={path.id}
              type="button"
              onClick={() => handleOpenWorkflow(path.id)}
              className="flex flex-col items-start p-6 bg-white rounded-2xl border-2 border-transparent hover:border-blue-600 shadow-sm hover:shadow-md transition-all text-left group"
            >
              <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center bg-${path.color}-50 text-${path.color}-600 group-hover:scale-110 transition-transform`}>
                <path.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{path.name}</h3>
              <p className="text-sm text-gray-500">{path.description}</p>
            </button>
          )
        ))}
      </div>

      {/* Search */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="mb-4">
            <label className="block text-lg font-bold text-gray-900">Quick Recognition</label>
            <p className="text-sm text-gray-500">Search for a colleague to give standard recognition</p>
        </div>
        
        <div className="relative">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-600 focus:bg-white outline-none transition-all"
            placeholder="Search by name or email..."
          />
        </div>

        {/* Search results */}
        {searchQuery.length >= 2 && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {isSearching ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                Searching...
              </div>
            ) : searchResults?.data?.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {searchResults.data
                  .filter((u) => u.id !== user.id)
                  .map((searchUser) => (
                    <button
                      key={searchUser.id}
                      type="button"
                      onClick={() => handleSelectUser(searchUser)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-blue-600 hover:bg-blue-50 transition-all text-left group"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        {(searchUser.first_name || 'U')[0]}{(searchUser.last_name || '')[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                          {searchUser.first_name} {searchUser.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{searchUser.corporate_email || searchUser.email}</p>
                      </div>
                      <HiOutlineStar className="w-6 h-6 text-gray-300 group-hover:text-yellow-400 group-hover:scale-110 transition-all" />
                    </button>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">No users found</div>
            )}
          </div>
        )}
      </div>

      {/* Quick recognize - badges */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Available Awards & Badges</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {badges?.length > 0 ? (
            badges.map((badge) => (
              <div
                key={badge.id}
                className="p-6 rounded-2xl border border-gray-100 text-center hover:border-blue-600 hover:bg-blue-50 transition-all group"
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform">
                  <HiOutlineStar className="w-8 h-8" />
                </div>
                <p className="font-bold text-gray-900 mb-1">{badge.name}</p>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">{badge.points_value} pts</p>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-gray-500 bg-gray-50 rounded-xl italic">
                No badges available for your tenant yet.
            </div>
          )}
        </div>
      </div>

      {/* Recent recognitions */}
      {recentRecognitions?.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Recognitions</h2>
          <div className="space-y-4">
            {recentRecognitions.slice(0, 5).map((rec) => (
              <FeedCard key={rec.id} item={{
                id: rec.id,
                recognition_id: rec.id,
                event_type: 'recognition',
                actor_name: rec.from_user_name,
                target_name: rec.to_user_name,
                metadata: { message: rec.message, points: rec.points },
                created_at: rec.created_at
              }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
