/**
 * Role Utility Functions
 * Reusable helper functions for role display and permissions
 */

/**
 * Role display configuration
 */
export const ROLE_CONFIG = {
  platform_admin: {
    label: 'Platform Admin',
    color: 'bg-purple-100 text-purple-800',
    badgeColor: 'purple',
    description: 'System-wide administrator'
  },
  tenant_manager: {
    label: 'Tenant Manager',
    color: 'bg-blue-100 text-blue-800',
    badgeColor: 'blue',
    description: 'Company administrator'
  },
  dept_lead: {
    label: 'Dept Lead',
    color: 'bg-green-100 text-green-800',
    badgeColor: 'green',
    description: 'Team lead'
  },
  tenant_user: {
    label: 'Tenant User',
    color: 'bg-gray-100 text-gray-800',
    badgeColor: 'gray',
    description: 'Regular employee'
  }
}

/**
 * Get display label for a role
 * @param {string} role - Role identifier
 * @returns {string} Human-readable role label
 */
export function getRoleLabel(role) {
  if (!role) return 'Unknown'
  return ROLE_CONFIG[role.toLowerCase()]?.label || formatRoleString(role)
}

/**
 * Get the CSS classes for role badge display
 * @param {string} role - Role identifier
 * @returns {string} Tailwind CSS classes
 */
export function getRoleBadgeClasses(role) {
  if (!role) return 'bg-gray-100 text-gray-800'
  return ROLE_CONFIG[role.toLowerCase()]?.color || 'bg-gray-100 text-gray-800'
}

/**
 * Format a role string to title case
 * @param {string} role - Role identifier  
 * @returns {string} Formatted role string
 */
export function formatRoleString(role) {
  if (!role) return ''
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * Check if a role is admin level (platform_admin or tenant_manager)
 * @param {string} role - Role identifier
 * @returns {boolean}
 */
export function isAdminRole(role) {
  if (!role) return false
  const adminRoles = ['platform_admin', 'tenant_manager']
  return adminRoles.includes(role.toLowerCase())
}

/**
 * Check if a role is lead level or higher
 * @param {string} role - Role identifier
 * @returns {boolean}
 */
export function isLeadOrHigher(role) {
  if (!role) return false
  const leadRoles = ['platform_admin', 'tenant_manager', 'dept_lead']
  return leadRoles.includes(role.toLowerCase())
}

/**
 * Get role hierarchy level (higher number = more permissions)
 * @param {string} role - Role identifier
 * @returns {number} Hierarchy level (0-4)
 */
export function getRoleLevel(role) {
  if (!role) return 0
  const levels = {
    platform_admin: 4,
    tenant_manager: 3,
    dept_lead: 2,
    tenant_user: 1
  }
  return levels[role.toLowerCase()] || 1
}
