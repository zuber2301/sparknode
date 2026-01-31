/**
 * User Utility Functions
 * Reusable helper functions for user data display and manipulation
 */

/**
 * Get the full name of a user from first_name and last_name fields
 * @param {Object} user - User object with first_name and last_name
 * @returns {string} Full name or 'Unknown User'
 */
export function getFullName(user) {
  if (!user) return 'Unknown User'
  const firstName = user.first_name || ''
  const lastName = user.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || 'Unknown User'
}

/**
 * Get initials from a user's name
 * @param {Object} user - User object with first_name and last_name
 * @returns {string} Two letter initials
 */
export function getInitials(user) {
  if (!user) return '??'
  const first = (user.first_name || '?').charAt(0).toUpperCase()
  const last = (user.last_name || '?').charAt(0).toUpperCase()
  return `${first}${last}`
}

/**
 * Get the primary email of a user (corporate_email or email fallback)
 * @param {Object} user - User object
 * @returns {string} Email address
 */
export function getEmail(user) {
  if (!user) return ''
  return user.corporate_email || user.email || ''
}

/**
 * Filter users by search term (checks name and email)
 * @param {Array} users - Array of user objects
 * @param {string} searchTerm - Search string
 * @returns {Array} Filtered users
 */
export function filterUsers(users, searchTerm) {
  if (!users || !searchTerm) return users || []
  const term = searchTerm.toLowerCase()
  return users.filter(user => {
    const fullName = getFullName(user).toLowerCase()
    const email = getEmail(user).toLowerCase()
    return fullName.includes(term) || email.includes(term)
  })
}

/**
 * Get display name with email for dropdowns/selections
 * @param {Object} user - User object
 * @returns {string} "Full Name (email)"
 */
export function getUserDisplayWithEmail(user) {
  const name = getFullName(user)
  const email = getEmail(user)
  return email ? `${name} (${email})` : name
}
