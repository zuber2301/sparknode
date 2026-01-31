/**
 * User Form Modal Component
 * 
 * Modal for creating and editing users.
 */

import { HiOutlineX } from 'react-icons/hi'

export default function UserFormModal({
  isOpen,
  onClose,
  user,
  departments,
  isSubmitting,
  onSubmit
}) {
  if (!isOpen) return null

  const isEditing = !!user

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {isEditing ? 'Edit User' : 'Create New User'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <HiOutlineX className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                name="first_name"
                required
                defaultValue={user?.first_name || ''}
                className="input"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                name="last_name"
                required
                defaultValue={user?.last_name || ''}
                className="input"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Corporate Email *</label>
            <input
              type="email"
              name="corporate_email"
              required
              defaultValue={user?.corporate_email || ''}
              className="input"
              placeholder="john@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Personal Email</label>
            <input
              type="email"
              name="personal_email"
              defaultValue={user?.personal_email || ''}
              className="input"
              placeholder="john.doe@gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
            <input
              type="tel"
              name="mobile_number"
              defaultValue={user?.mobile_number || ''}
              className="input"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
            <select
              name="department_id"
              required
              defaultValue={user?.department_id || ''}
              className="input"
            >
              <option value="">Select Department</option>
              {departments?.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              name="org_role"
              required
              defaultValue={user?.org_role || 'corporate_user'}
              className="input"
            >
              <option value="corporate_user">Corporate User</option>
              <option value="tenant_lead">Tenant Leader</option>
              <option value="tenant_admin">Tenant Admin</option>
            </select>
          </div>

          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                defaultValue={user?.status || 'active'}
                className="input"
              >
                <option value="active">Active</option>
                <option value="pending_invitation">Pending Invitation</option>
                <option value="deactivated">Deactivated</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
