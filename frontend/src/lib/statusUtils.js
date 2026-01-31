/**
 * Status Utility Functions
 * Reusable helper functions for status display across the application
 */

/**
 * Status configuration for users
 */
export const USER_STATUS_CONFIG = {
  active: {
    label: 'Active',
    color: 'bg-green-100 text-green-800',
    dotColor: 'bg-green-500'
  },
  ACTIVE: {
    label: 'Active',
    color: 'bg-green-100 text-green-800',
    dotColor: 'bg-green-500'
  },
  pending_invite: {
    label: 'Pending Invite',
    color: 'bg-yellow-100 text-yellow-800',
    dotColor: 'bg-yellow-500'
  },
  PENDING_INVITE: {
    label: 'Pending Invite',
    color: 'bg-yellow-100 text-yellow-800',
    dotColor: 'bg-yellow-500'
  },
  deactivated: {
    label: 'Deactivated',
    color: 'bg-red-100 text-red-800',
    dotColor: 'bg-red-500'
  },
  DEACTIVATED: {
    label: 'Deactivated',
    color: 'bg-red-100 text-red-800',
    dotColor: 'bg-red-500'
  },
  suspended: {
    label: 'Suspended',
    color: 'bg-red-100 text-red-800',
    dotColor: 'bg-red-500'
  }
}

/**
 * Status configuration for tenants
 */
export const TENANT_STATUS_CONFIG = {
  active: {
    label: 'Active',
    color: 'bg-green-100 text-green-800',
    dotColor: 'bg-green-500'
  },
  inactive: {
    label: 'Inactive',
    color: 'bg-gray-100 text-gray-800',
    dotColor: 'bg-gray-500'
  },
  suspended: {
    label: 'Suspended',
    color: 'bg-red-100 text-red-800',
    dotColor: 'bg-red-500'
  },
  trial: {
    label: 'Trial',
    color: 'bg-blue-100 text-blue-800',
    dotColor: 'bg-blue-500'
  }
}

/**
 * Status configuration for events
 */
export const EVENT_STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    color: 'bg-gray-100 text-gray-800',
    dotColor: 'bg-gray-500'
  },
  published: {
    label: 'Published',
    color: 'bg-green-100 text-green-800',
    dotColor: 'bg-green-500'
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800',
    dotColor: 'bg-red-500'
  },
  completed: {
    label: 'Completed',
    color: 'bg-blue-100 text-blue-800',
    dotColor: 'bg-blue-500'
  }
}

/**
 * Status configuration for nominations
 */
export const NOMINATION_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800',
    dotColor: 'bg-yellow-500'
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-100 text-green-800',
    dotColor: 'bg-green-500'
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800',
    dotColor: 'bg-red-500'
  }
}

/**
 * Get status badge classes for a user status
 * @param {string} status - User status
 * @returns {string} Tailwind CSS classes
 */
export function getUserStatusClasses(status) {
  if (!status) return 'bg-gray-100 text-gray-800'
  return USER_STATUS_CONFIG[status]?.color || 'bg-gray-100 text-gray-800'
}

/**
 * Get status label for display
 * @param {string} status - Status string
 * @param {string} type - Status type: 'user', 'tenant', 'event', 'nomination'
 * @returns {string} Human-readable status label
 */
export function getStatusLabel(status, type = 'user') {
  if (!status) return 'Unknown'
  
  const configs = {
    user: USER_STATUS_CONFIG,
    tenant: TENANT_STATUS_CONFIG,
    event: EVENT_STATUS_CONFIG,
    nomination: NOMINATION_STATUS_CONFIG
  }
  
  const config = configs[type] || USER_STATUS_CONFIG
  return config[status]?.label || formatStatusString(status)
}

/**
 * Get status badge configuration
 * @param {string} status - Status string
 * @param {string} type - Status type
 * @returns {Object} Status configuration object
 */
export function getStatusConfig(status, type = 'user') {
  const configs = {
    user: USER_STATUS_CONFIG,
    tenant: TENANT_STATUS_CONFIG,
    event: EVENT_STATUS_CONFIG,
    nomination: NOMINATION_STATUS_CONFIG
  }
  
  const config = configs[type] || USER_STATUS_CONFIG
  return config[status] || { label: formatStatusString(status), color: 'bg-gray-100 text-gray-800', dotColor: 'bg-gray-500' }
}

/**
 * Format a status string to title case
 * @param {string} status - Status identifier
 * @returns {string} Formatted status string
 */
export function formatStatusString(status) {
  if (!status) return ''
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}
