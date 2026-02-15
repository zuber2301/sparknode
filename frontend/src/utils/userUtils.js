/**
 * User utility functions for formatting and display
 */

export function formatUserName(user) {
  if (!user) return 'Unknown User'
  const firstName = user.first_name || ''
  const lastName = user.last_name || ''
  return `${firstName} ${lastName}`.trim() || user.corporate_email || 'Unknown User'
}

export function formatUserEmail(user) {
  return user.corporate_email || user.email || user.personal_email || 'No email'
}

export function formatRoleLabel(role) {
  const roleLabels = {
    'platform_admin': 'Platform Admin',
    'tenant_manager': 'Tenant Manager',
    'dept_lead': 'Department Lead',
    'dept_lead': 'Department Lead',
    'tenant_user': 'User'
  }
  return roleLabels[role] || role || 'Unknown Role'
}

export function formatRoleColor(role) {
  const roleColors = {
    'platform_admin': 'bg-red-100 text-red-800',
    'tenant_manager': 'bg-purple-100 text-purple-800',
    'dept_lead': 'bg-indigo-100 text-indigo-800',
    'tenant_user': 'bg-green-100 text-green-800'
  }
  return roleColors[role] || 'bg-gray-100 text-gray-800'
}

export function formatStatusColor(status) {
  const statusColors = {
    'active': 'bg-green-100 text-green-800',
    'inactive': 'bg-yellow-100 text-yellow-800',
    'pending_invite': 'bg-blue-100 text-blue-800',
    'deactivated': 'bg-red-100 text-red-800'
  }
  return statusColors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}