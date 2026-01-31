/**
 * User Table Component
 * 
 * Displays the list of users in a table format with actions.
 */

import { HiOutlinePencil, HiOutlineDotsVertical, HiOutlineMail, HiOutlineSparkles, HiOutlineTrash, HiOutlineExclamationCircle, HiOutlineCheckCircle } from 'react-icons/hi'
import { formatRoleColor, formatStatusColor, formatRoleLabel, formatUserName, formatUserEmail } from '../../utils/userUtils'

export default function UserTable({ 
  users, 
  selectedUserIds, 
  onToggleSelection, 
  onSelectAll,
  onEdit, 
  activeDropdown, 
  setActiveDropdown,
  onSendInvite,
  onAllocatePoints,
  onDeactivate
}) {
  if (!users || users.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No users found</p>
      </div>
    )
  }

  const allSelected = users.length > 0 && selectedUserIds.length === users.length

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onSelectAll(users)}
                className="rounded border-gray-300"
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelected={selectedUserIds.includes(user.id)}
              onToggleSelection={onToggleSelection}
              onEdit={onEdit}
              activeDropdown={activeDropdown}
              setActiveDropdown={setActiveDropdown}
              onSendInvite={onSendInvite}
              onAllocatePoints={onAllocatePoints}
              onDeactivate={onDeactivate}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UserRow({
  user,
  isSelected,
  onToggleSelection,
  onEdit,
  activeDropdown,
  setActiveDropdown,
  onSendInvite,
  onAllocatePoints,
  onDeactivate
}) {
  const statusLower = user.status?.toLowerCase() || ''
  const isPending = statusLower.includes('pending')

  return (
    <tr className={isSelected ? 'bg-indigo-50' : undefined}>
      <td className="px-6 py-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelection(user.id)}
          className="rounded border-gray-300"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            {user.avatar_url ? (
              <img
                className="h-10 w-10 rounded-full object-cover"
                src={user.avatar_url}
                alt={formatUserName(user)}
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-medium">
                {user.first_name?.[0]}{user.last_name?.[0]}
              </div>
            )}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {formatUserName(user)}
            </div>
            <div className="text-sm text-gray-500">
              {formatUserEmail(user)}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-900">{user.department_name || '-'}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${formatRoleColor(user.org_role)}`}>
          {formatRoleLabel(user.org_role)}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`badge ${formatStatusColor(user.status)}`}>
          {isPending ? (
            <HiOutlineExclamationCircle className="w-4 h-4 mr-1" />
          ) : (
            <HiOutlineCheckCircle className="w-4 h-4 mr-1" />
          )}
          {user.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div>{user.mobile_number || '-'}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(user)}
            className="text-indigo-600 hover:text-indigo-900 p-1"
            title="Edit"
          >
            <HiOutlinePencil className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === user.id ? null : user.id)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <HiOutlineDotsVertical className="w-5 h-5" />
            </button>
            
            {activeDropdown === user.id && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1" role="menu">
                  {isPending && (
                    <button
                      onClick={() => {
                        onSendInvite(user.id)
                        setActiveDropdown(null)
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    >
                      <HiOutlineMail className="w-4 h-4" />
                      Resend Invite
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onAllocatePoints(user.id)
                      setActiveDropdown(null)
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <HiOutlineSparkles className="w-4 h-4" />
                    Allocate Points
                  </button>
                  <button
                    onClick={() => {
                      onDeactivate(user.id)
                      setActiveDropdown(null)
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                    Deactivate
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}
