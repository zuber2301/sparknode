import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// Use a relative API base by default so the SPA can be served from the same origin
// and API requests go through the nginx proxy at `/api`. During local development
// set `VITE_API_URL` to an absolute URL if needed (e.g. http://localhost:7100).
const API_URL = import.meta.env.VITE_API_URL || ''

// ── Subdomain detection ───────────────────────────────────────────────────────
// Reads the subdomain from the current hostname.
// e.g. 'unimind.sparknode.io' → 'unimind'
// Falls back to null on the root domain, localhost, or IP.
export function detectSubdomain() {
  const host = window.location.hostname.toLowerCase()
  const roots = ['sparknode.io', 'lvh.me']
  for (const root of roots) {
    if (host.endsWith('.' + root)) {
      const sub = host.slice(0, -(root.length + 1))
      if (sub && !sub.includes('.') && !['www', 'app', 'api'].includes(sub)) {
        return sub
      }
    }
  }
  // Local dev: allow VITE_TENANT_SLUG env to simulate a subdomain
  return import.meta.env.VITE_TENANT_SLUG || null
}

export const currentSubdomain = detectSubdomain()

// Resolved tenant info cache (populated by resolveTenantSlug on app start)
export let resolvedTenant = null
export function setResolvedTenant(t) { resolvedTenant = t }

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token and tenant context
api.interceptors.request.use(
  (config) => {
    const state = useAuthStore.getState()
    const token = state.token
    const tenantId = state.getTenantId()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Allow callers to skip adding tenant header for platform-level APIs.
    // If a request sets `X-Skip-Tenant` header or `config.skipTenant` we will not attach X-Tenant-ID.
    const skipTenantHeader = config.headers && (config.headers['X-Skip-Tenant'] || config.headers['X-Skip-Tenant'] === '1')
    const skipTenantFlag = config.skipTenant === true

    if (!skipTenantHeader && !skipTenantFlag) {
      // Add tenant context header for explicit tenant isolation, but only if it's a valid UUID
      if (tenantId && tenantId !== '00000000-0000-0000-0000-000000000000') {
        config.headers['X-Tenant-ID'] = tenantId
      }
    }

    // Clean up the helper header so it's not sent to the backend
    if (config.headers && config.headers['X-Skip-Tenant']) {
      delete config.headers['X-Skip-Tenant']
    }
    
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Do NOT force-logout when the 401 comes from the login/OTP endpoints
      // themselves — a wrong password legitimately returns 401, and redirecting
      // to /login from the login page creates a confusing reload loop.
      const requestUrl = error.config?.url || ''
      const isAuthEndpoint =
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/otp/') ||
        requestUrl.includes('/auth/signup') ||
        requestUrl.includes('/auth/token') ||
        requestUrl.includes('/auth/tenant-resolve') ||
        requestUrl.includes('/auth/me/context')
      if (!isAuthEndpoint) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }
    // Handle tenant access errors
    if (error.response?.status === 403 && error.response?.data?.detail?.includes('tenant')) {
      console.error('Tenant access denied:', error.response.data.detail)
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }, { skipTenant: true }),
  signup: (email, password, first_name, last_name, personal_email, mobile_number, invitation_token) => 
    api.post('/auth/signup', { 
      email, 
      password, 
      first_name, 
      last_name, 
      personal_email, 
      mobile_number, 
      invitation_token 
    }, { skipTenant: true }),
  me: () => api.get('/auth/me'),
  meContext: () => api.get('/auth/me/context'),
  completeOnboarding: () => api.post('/auth/me/complete-onboarding'),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh'),
  // Subdomain → tenant_id public lookup (no auth required)
  resolveTenantSlug: (slug) => api.get('/auth/tenant-resolve', { params: { slug }, skipTenant: true }),
  // OTP login/signup (find-or-create flow)
  requestEmailOtp: (email, tenant_id) => api.post('/auth/otp/email/request', { email, tenant_id }, { skipTenant: true }),
  verifyEmailOtp: (email, code, tenant_id) => api.post('/auth/otp/email/verify', { email, code, tenant_id }, { skipTenant: true }),
  requestSmsOtp: (mobile_number, tenant_id) => api.post('/auth/otp/sms/request', { mobile_number, tenant_id }, { skipTenant: true }),
  verifySmsOtp: (mobile_number, code, tenant_id) => api.post('/auth/otp/sms/verify', { mobile_number, code, tenant_id }, { skipTenant: true }),
  generateInvitationLink: (email, expires_hours) => api.post('/auth/invitations/generate', { email, expires_hours }),
  getRoles: () => api.get('/auth/roles'),
  switchRole: (role) => api.post('/auth/switch-role', { role }),
}

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  patch: (id, data) => api.patch(`/users/${id}`, data),
  search: (q) => api.get('/users/search', { params: { q } }),
  getDirectReports: (id) => api.get(`/users/${id}/direct-reports`),
  bulkCreate: (data) => api.post('/users/bulk', data),
  deactivate: (id) => api.put(`/users/${id}/deactivate`),
  activate: (id) => api.post(`/users/${id}/activate`),
  reactivate: (id) => api.put(`/users/${id}/reactivate`),
  downloadTemplate: () => api.get('/users/bulk/template', { responseType: 'blob' }),
  uploadBulk: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/users/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getStaging: (batchId) => api.get(`/users/staging/${batchId}`),
  updateStagingRow: (rowId, data) => api.patch(`/users/staging/row/${rowId}`, data),
  confirmBulk: (batchId, payload) => api.post(`/users/staging/${batchId}/confirm`, payload),
  bulkDeactivate: (payload) => api.post('/users/bulk/deactivate', payload),
  bulkReactivate: (payload) => api.post('/users/bulk/reactivate', payload),
  bulkResendInvites: (payload) => api.post('/users/bulk/resend-invites', payload),
}

// Wallets API
export const walletsAPI = {
  getMyWallet: () => api.get('/wallets/me'),
  getMyLedger: (params) => api.get('/wallets/me/ledger', { params }),
  getUserWallet: (userId) => api.get(`/wallets/${userId}`),
  allocatePoints: (data) => api.post('/wallets/allocate', data),
  bulkAllocate: (data) => api.post('/wallets/allocate/bulk', data),
  adjustBalance: (userId, data) => api.post(`/wallets/${userId}/adjust`, data),
}

// Budgets API
export const budgetsAPI = {
  getAll: (params) => api.get('/budgets', { params }),
  getById: (id) => api.get(`/budgets/${id}`),
  create: (data) => api.post('/budgets', data),
  update: (id, data) => api.put(`/budgets/${id}`, data),
  allocate: (id, data) => api.post(`/budgets/${id}/allocate`, data),
  getDepartmentBudgets: (id) => api.get(`/budgets/${id}/departments`),
  activate: (id) => api.put(`/budgets/${id}/activate`),
  getUtilization: (id) => api.get(`/budgets/${id}/utilization`),
  getPool: () => api.get('/budgets/pool'),
}

// Dashboard API
export const dashboardApi = {
  getSummary: () => api.get('/analytics/dashboard/summary'),
}

// Dept Lead Dashboard API
export const deptDashboardApi = {
  getDeptSummary: () => api.get('/analytics/dashboard/dept-summary'),
}

// Tenant Manager Budget Distribution API
export const tmDistributeApi = {
  // Dept per-user workflow
  getDeptPreview: () => api.get('/budgets/dept-per-user-preview'),
  distributeToDeptPerUser: (data) => api.post('/budgets/distribute-dept-per-user', data),
  // All-users workflow
  getAllUsersPreview: () => api.get('/budgets/all-users-preview'),
  distributeToAllUsers: (data) => api.post('/budgets/distribute-all-users', data),
}

// Recognition API
export const recognitionAPI = {
  getAll: (params) => api.get('/recognitions', { params }),
  getById: (id) => api.get(`/recognitions/${id}`),
  create: (data) => api.post('/recognitions', data),
  getBadges: () => api.get('/recognitions/badges'),
  toggleReaction: (id, reactionType = 'like') => api.post(`/recognitions/${id}/react`, { reaction_type: reactionType }),
  addOnPoints: (id, data) => api.post(`/recognitions/${id}/addon`, data),
  getComments: (id) => api.get(`/recognitions/${id}/comments`),
  addComment: (id, data) => api.post(`/recognitions/${id}/comments`, data),
  getMyStats: () => api.get('/recognitions/stats/me'),
  getUserStats: (userId) => api.get(`/recognitions/stats/${userId}`),
}

// Engagement (EEE) API
export const engagementAPI = {
  getValues: () => api.get('/engagement/values'),
  createValue: (data) => api.post('/engagement/values', data),
  updateValue: (id, data) => api.put(`/engagement/values/${id}`, data),
  deleteValue: (id) => api.delete(`/engagement/values/${id}`),
  getChallenges: () => api.get('/engagement/challenges'),
  createChallenge: (data) => api.post('/engagement/challenges', data),
  updateChallenge: (id, data) => api.put(`/engagement/challenges/${id}`, data),
  completeChallenge: (id) => api.post(`/engagement/challenges/${id}/complete`),
  getMilestones: (days = 30) => api.get('/engagement/milestones/upcoming', { params: { days } }),
}

// Redemption API
export const redemptionAPI = {
  getBrands: (params) => api.get('/redemptions/brands', { params }),
  getCategories: () => api.get('/redemptions/brands/categories'),
  getVouchers: (params) => api.get('/redemptions/vouchers', { params }),
  getVoucherById: (id) => api.get(`/redemptions/vouchers/${id}`),
  create: (data) => api.post('/redemptions', data),
  initiate: (data) => api.post('/redemptions/initiate', data),
  verifyOTP: (data) => api.post('/redemptions/verify-otp', data),
  deliveryDetails: (data) => api.post('/redemptions/delivery-details', data),
  resendOTP: (redemptionId) => api.post('/redemptions/resend-otp', null, { params: { redemption_id: redemptionId } }),
  getMyRedemptions: (params) => api.get('/redemptions', { params }),
  getById: (id) => api.get(`/redemptions/${id}`),
  // Tenant catalog management
  getCatalogSettings: () => api.get('/redemptions/catalog/settings'),
  updateCatalogSettings: (data) => api.put('/redemptions/catalog/settings', data),
}

// Feed API
export const feedAPI = {
  getAll: (params) => api.get('/feed', { params }),
  getMyFeed: (params) => api.get('/feed/my', { params }),
  getDepartmentFeed: (params) => api.get('/feed/department', { params }),
}

// Notifications API
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getCount: () => api.get('/notifications/count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
}

// Tenants API
export const tenantsAPI = {
  getCurrent: () => api.get('/tenants/current'),
  getBySlug: (slug) => api.get(`/tenant/${slug}`),
  updateCurrent: (data) => api.put('/tenants/current', data),
  getDepartments: () => api.get('/tenants/departments'),
  getDepartmentManagement: () => api.get('/tenants/departments/management'),
  createDepartment: (data) => api.post('/tenants/departments', data),
  updateDepartment: (id, data) => api.put(`/tenants/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/tenants/departments/${id}`),
  allocateDepartmentBudget: (deptId, amount) => api.post(`/tenants/departments/${deptId}/allocate-budget`, { amount }),
  assignDepartmentLead: (deptId, userId) => api.post(`/tenants/departments/${deptId}/assign-lead`, { user_id: userId }),
  checkDepartmentName: (name) => api.post('/tenants/departments/check-name', { name }),
  createDepartmentWithAllocation: (data) => api.post('/tenants/departments/create-and-allocate', data),
  recallDepartmentBudget: (deptId, amount) => api.post(`/tenants/departments/${deptId}/recall-budget`, { amount }),
  // Tenant settings and branding
  getSettings: () => api.get('/tenants/settings'),
  updateSettings: (data) => api.put('/tenants/settings', data),
  getBranding: () => api.get('/tenants/branding'),
  updateBranding: (data) => api.put('/tenants/branding', data),
  uploadLogo: (file) => {
    const formData = new FormData()
    formData.append('logo', file)
    return api.post('/tenants/branding/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// Audit API
export const auditAPI = {
  getLogs: (params) => api.get('/audit', { params }),
  getActions: () => api.get('/audit/actions'),
  getEntityTypes: () => api.get('/audit/entity-types'),
}

// Platform Admin API (Tenant Manager)
export const platformAPI = {
  getTenants: (params) => api.get('/platform/tenants', { params, headers: { 'X-Skip-Tenant': '1' } }),
  getTenantById: (tenantId) => api.get(`/platform/tenants/${tenantId}`, { headers: { 'X-Skip-Tenant': '1' } }),
  createTenant: (data) => api.post('/platform/tenants', data, { headers: { 'X-Skip-Tenant': '1' } }),
  updateTenant: (tenantId, data) => api.put(`/platform/tenants/${tenantId}`, data, { headers: { 'X-Skip-Tenant': '1' } }),
  updateTenantCurrency: (tenantId, data) => api.patch(`/platform/tenants/${tenantId}/currency`, data, { headers: { 'X-Skip-Tenant': '1' } }),
  uploadLogo: (tenantId, file) => {
    const formData = new FormData()
    formData.append('logo', file)
    return api.post(`/platform/tenants/${tenantId}/branding/logo`, formData, { headers: { 'Content-Type': 'multipart/form-data', 'X-Skip-Tenant': '1' } })
  },
  suspendTenant: (tenantId, reason) => api.post(`/platform/tenants/${tenantId}/suspend`, null, { params: { reason }, headers: { 'X-Skip-Tenant': '1' } }),
  activateTenant: (tenantId) => api.post(`/platform/tenants/${tenantId}/activate`, null, { headers: { 'X-Skip-Tenant': '1' } }),
  updateSubscription: (tenantId, data) => api.put(`/platform/tenants/${tenantId}/subscription`, data),
  getSubscriptionTiers: () => api.get('/platform/subscription-tiers'),
  getFeatureFlags: (tenantId) => api.get(`/platform/tenants/${tenantId}/feature_flags`),
  updateFeatureFlags: (tenantId, data) => api.patch(`/platform/tenants/${tenantId}/feature_flags`, data),
  recalculateBalances: (tenantId) => api.post(`/platform/tenants/${tenantId}/recalculate-balances`, null, { headers: { 'X-Skip-Tenant': '1' } }),
  getBudgetActivity: (tenantId, params = {}) => api.get(`/platform/tenants/${tenantId}/budget-activity`, { params, headers: { 'X-Skip-Tenant': '1' } }),
  addMasterBudget: (tenantId, data) => api.post(`/platform/tenants/${tenantId}/master-budget`, data, { headers: { 'X-Skip-Tenant': '1' } }),
  recallMasterBudget: (tenantId, data) => api.post(`/platform/tenants/${tenantId}/recall-budget`, data, { headers: { 'X-Skip-Tenant': '1' } }),
  getTenantUsers: (tenantId, params = {}) => api.get(`/users/tenant/${tenantId}/users`, { params, headers: { 'X-Skip-Tenant': '1' } }),
  getMetrics: (params) => api.get('/analytics/platform', { params }),
  getHealth: () => api.get('/platform/health'),
  getAuditLogs: (params) => api.get('/platform/audit-logs', { params }),
  getGlobalSettings: () => api.get('/platform/settings'),
  updateGlobalSettings: (data) => api.put('/platform/settings', data),
  getBrands: (params) => api.get('/platform/brands', { params }),
  createBrand: (data) => api.post('/platform/brands', data),
  updateBrand: (id, data) => api.put(`/platform/brands/${id}`, data),
  getVouchers: (params) => api.get('/platform/vouchers', { params }),
  createVoucher: (data) => api.post('/platform/vouchers', data),
  updateVoucher: (id, data) => api.put(`/platform/vouchers/${id}`, data),
  // Budget Ledger API
  getBudgetStats: (params = {}) => api.get('/platform/ledger/stats', { 
    params, 
    headers: { 'X-Skip-Tenant': '1' } 
  }),
  getBudgetActivity: (params = {}) => api.get('/platform/ledger/activity', { 
    params, 
    headers: { 'X-Skip-Tenant': '1' } 
  }),
  getTenantsWithBudgets: (params = {}) => api.get('/platform/ledger/tenants', { 
    params, 
    headers: { 'X-Skip-Tenant': '1' } 
  }),
  getFullBudgetLedger: (params = {}) => api.get('/platform/ledger/full-ledger', { 
    params, 
    headers: { 'X-Skip-Tenant': '1' } 
  }),
  // Budget Ledger Export API
  exportBudgetLedgerCSV: (params = {}) => api.get('/platform/ledger/export/csv', { 
    params, 
    responseType: 'blob',
    headers: { 'X-Skip-Tenant': '1' } 
  }),
  exportBudgetLedgerJSON: (params = {}) => api.get('/platform/ledger/export/json', { 
    params, 
    headers: { 'X-Skip-Tenant': '1' } 
  }),
  // Budget Alert API
  checkBudgetHealth: () => api.get('/platform/alerts/health', { 
    headers: { 'X-Skip-Tenant': '1' } 
  }),
  getAlertHistory: (params = {}) => api.get('/platform/alerts/history', { 
    params, 
    headers: { 'X-Skip-Tenant': '1' } 
  }),
  checkAndNotify: () => api.post('/platform/alerts/check-and-notify', null, { 
    headers: { 'X-Skip-Tenant': '1' } 
  }),
  acknowledgeAlert: (alertId) => api.post(`/platform/alerts/acknowledge/${alertId}`, null, { 
    headers: { 'X-Skip-Tenant': '1' } 
  }),
}

// Events API (New - Multi-tenant Events & Logistics)
export const eventsAPI = {
  // Events CRUD
  getAll: (params) => api.get('/events', { params }),
  getById: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  
  // Event status management
  publish: (id) => api.put(`/events/${id}`, { status: 'published' }),
  cancel: (id, reason) => api.put(`/events/${id}/cancel`, { reason }),
  complete: (id) => api.put(`/events/${id}/complete`),
  
  // Activities
  getActivities: (eventId) => api.get(`/events/${eventId}/activities`),
  createActivity: (eventId, data) => api.post(`/events/${eventId}/activities`, data),
  updateActivity: (eventId, activityId, data) => 
    api.put(`/events/${eventId}/activities/${activityId}`, data),
  deleteActivity: (eventId, activityId) => 
    api.delete(`/events/${eventId}/activities/${activityId}`),
  
  // Registration & Participants
  register: (eventId, data) => api.post(`/events/${eventId}/register`, data),
  getParticipants: (eventId, params) => api.get(`/events/${eventId}/participants`, { params }),
  approveParticipant: (eventId, participantId) => 
    api.put(`/events/${eventId}/participants/${participantId}/approve`),
  rejectParticipant: (eventId, participantId, reason) => 
    api.put(`/events/${eventId}/participants/${participantId}/reject`, { reason }),
  
  // QR Check-in
  generateQR: (eventId) => api.post(`/events/${eventId}/qr`),
  checkIn: (eventId, data) => api.post(`/events/${eventId}/check-in`, data),
  verifyQR: (token) => api.post('/events/qr/verify', { token }),
  
  // Gift Management
  getGiftItems: (activityId) => api.get(`/events/activities/${activityId}/gifts`),
  createGiftItem: (activityId, data) => api.post(`/events/activities/${activityId}/gifts`, data),
  allocateGift: (giftId, data) => api.post(`/events/gifts/${giftId}/allocate`, data),
  bulkAllocateGifts: (giftId, data) => api.post(`/events/gifts/${giftId}/allocate/bulk`, data),
  
  // Gift Pickup
  getMyGifts: () => api.get('/events/my-gifts'),
  generatePickupQR: (allocationId) => api.post(`/events/gifts/allocations/${allocationId}/qr`),
  verifyPickup: (token) => api.post('/events/gifts/verify-pickup', { token }),
  
  // Event Budget
  getEventBudget: (eventId) => api.get(`/events/${eventId}/budget`),
  updateEventBudget: (eventId, data) => api.put(`/events/${eventId}/budget`, data),
  
  // My Events
  getMyEvents: (params) => api.get('/events/my', { params }),
  getMyRegistrations: (params) => api.get('/events/my/registrations', { params }),
}

// Sales & Marketing API (Sales Events)
export const salesAPI = {
  create: (data) => api.post('/sales-events', data),
  list: (params) => api.get('/sales-events', { params }),
  get: (id) => api.get(`/sales-events/${id}`),
  update: (id, data) => api.patch(`/sales-events/${id}`, data),
  publish: (id) => api.post(`/sales-events/${id}/publish`),
  publicRegister: (id, data) => api.post(`/sales-events/public/${id}/register`, data, { skipTenant: true }),
  registrations: (id) => api.get(`/sales-events/${id}/registrations`),
  leads: (id) => api.get(`/sales-events/${id}/leads`),
  updateLead: (leadId, data) => api.patch(`/sales-events/leads/${leadId}`, data),
  metrics: (id) => api.get(`/sales-events/${id}/metrics`),
  metricsSummary: () => api.get('/sales-events/metrics/summary'),
  // gamification helpers
  incrementProgress: (eventId, data) => api.post(`/sales-events/${eventId}/progress`, data),
  leaderboard: (eventId) => api.get(`/sales-events/${eventId}/leaderboard`),
}

// Analytics API (New - Tenant Dashboard & Insights)
export const analyticsAPI = {
  // Tenant Analytics
  getDashboard: (params) => api.get('/analytics/dashboard', { params }),
  getInsights: (params) => api.get('/analytics/insights', { params }),
  getBenchmark: () => api.get('/analytics/benchmark'),
  getSpendAnalysis: (params) => api.get('/analytics/spend-analysis', { params }),
  
  // Specific metrics
  getEngagementMetrics: (params) => api.get('/analytics/engagement', { params }),
  getBudgetMetrics: (params) => api.get('/analytics/budget', { params }),
  getRedemptionMetrics: (params) => api.get('/analytics/redemption', { params }),
  getRecognitionMetrics: (params) => api.get('/analytics/recognition', { params }),
  
  // Department analytics
  getDepartmentMetrics: (departmentId, params) => 
    api.get(`/analytics/departments/${departmentId}`, { params }),
  
  // Leaderboards
  getTopRecognizers: (params) => api.get('/analytics/leaderboard/recognizers', { params }),
  getTopRecipients: (params) => api.get('/analytics/leaderboard/recipients', { params }),
  
  // Trends
  getDailyTrends: (params) => api.get('/analytics/trends/daily', { params }),
  getWeeklyTrends: (params) => api.get('/analytics/trends/weekly', { params }),
  getMonthlyTrends: (params) => api.get('/analytics/trends/monthly', { params }),
  
  // Export
  exportReport: (params) => api.get('/analytics/export', { 
    params, 
    responseType: 'blob' 
  }),
}

// ── Catalog API ──────────────────────────────────────────────────────────────
export const catalogAPI = {
  // Employee-facing browse
  browse: (params) => api.get('/catalog/browse', { params }),
  browseCategories: () => api.get('/catalog/browse/categories'),

  // Tenant Manager — master catalog overlay
  getTenantItems: (params) => api.get('/catalog/tenant/items', { params }),
  getTenantCategories: () => api.get('/catalog/tenant/categories'),
  upsertTenantItem: (masterItemId, data) => api.put(`/catalog/tenant/items/${masterItemId}`, data),
  toggleTenantItem: (masterItemId) => api.patch(`/catalog/tenant/items/${masterItemId}/toggle`),

  // Tenant Manager — custom items
  getCustomItems: () => api.get('/catalog/tenant/custom'),
  createCustomItem: (data) => api.post('/catalog/tenant/custom', data),
  updateCustomItem: (id, data) => api.patch(`/catalog/tenant/custom/${id}`, data),
  deleteCustomItem: (id) => api.delete(`/catalog/tenant/custom/${id}`),

  // Platform Admin — master catalog CRUD
  adminListItems: (params) => api.get('/catalog/admin/items', { params }),
  adminGetItem: (id) => api.get(`/catalog/admin/items/${id}`),
  adminCreateItem: (data) => api.post('/catalog/admin/items', data),
  adminUpdateItem: (id, data) => api.patch(`/catalog/admin/items/${id}`, data),
  adminDeleteItem: (id) => api.delete(`/catalog/admin/items/${id}`),
  adminToggleItem: (id) => api.patch(`/catalog/admin/items/${id}/toggle`),
  adminCategories: () => api.get('/catalog/admin/categories'),
  adminItemTenants: (id) => api.get(`/catalog/admin/items/${id}/tenants`),
}
export const catalogApi = catalogAPI

// ── Sales Campaigns (Exhibition / Booth) ─────────────────────────────────────
export const campaignAPI = {
  create: (data)                   => api.post('/campaigns/', data),
  list: ()                         => api.get('/campaigns/'),
  pendingApprovals: ()             => api.get('/campaigns/pending-approvals'),
  get: (id)                        => api.get(`/campaigns/${id}`),
  update: (id, data)               => api.patch(`/campaigns/${id}`, data),
  submit: (id)                     => api.post(`/campaigns/${id}/submit`),
  approve: (id, data)              => api.post(`/campaigns/${id}/approve`, data),
  addParticipants: (id, data)      => api.post(`/campaigns/${id}/participants`, data),
  removeParticipant: (id, userId)  => api.delete(`/campaigns/${id}/participants/${userId}`),
  registerLead: (id, data)         => api.post(`/campaigns/${id}/register-lead`, data),
  leads: (id)                      => api.get(`/campaigns/${id}/leads`),
  leaderboard: (id)                => api.get(`/campaigns/${id}/leaderboard`),
}

// Alias exports for component compatibility
export const engagementApi = engagementAPI
export const recognitionApi = recognitionAPI
export const usersApi = usersAPI
export const walletsApi = walletsAPI
export const budgetsApi = budgetsAPI
export const redemptionApi = redemptionAPI
export const feedApi = feedAPI
export const notificationsApi = notificationsAPI
export const tenantsApi = tenantsAPI
export const auditApi = auditAPI
export const authApi = authAPI
export const eventsApi = eventsAPI
export const analyticsApi = analyticsAPI
export const platformApi = platformAPI

// ── Billing & Invoicing API ──────────────────────────────────────────────────
export const billingAPI = {
  /** List all invoices (platform admin). Accepts { status, tenant_id, skip, limit } */
  listInvoices: (params) =>
    api.get('/billing/invoices', { params, headers: { 'X-Skip-Tenant': '1' } }),
  /** List invoices for a specific tenant. */
  getTenantInvoices: (tenantId, params) =>
    api.get(`/billing/tenants/${tenantId}/invoices`, { params, headers: { 'X-Skip-Tenant': '1' } }),
  /** Manually generate an invoice for a tenant: { tenant_id, notes?, period_start? } */
  generateInvoice: (data) =>
    api.post('/billing/invoices/generate', data, { headers: { 'X-Skip-Tenant': '1' } }),
  /** (Re)send an existing invoice by id. */
  sendInvoice: (invoiceId) =>
    api.post(`/billing/invoices/${invoiceId}/send`, {}, { headers: { 'X-Skip-Tenant': '1' } }),
  /** Update invoice status: { status, notes? } */
  updateStatus: (invoiceId, data) =>
    api.patch(`/billing/invoices/${invoiceId}/status`, data, { headers: { 'X-Skip-Tenant': '1' } }),
  /** Returns the URL to stream/download the invoice PDF (open in a new tab). */
  getPdfUrl: (invoiceId) => `/api/billing/invoices/${invoiceId}/pdf`,
}

// ── Experiences API ──────────────────────────────────────────────────────────
export const experiencesAPI = {
  /** Return the list of experience types available to the current tenant. */
  getAvailable: () => api.get('/auth/experiences'),
}

// ── Pulse Surveys API ────────────────────────────────────────────────────────
export const surveysAPI = {
  /** Admin: create a pulse survey. body: { title?, target_department?, nps_enabled?, closes_in_days?, extra_questions? } */
  createPulse: (body) => api.post('/surveys/create-pulse', body),
  /** Admin: list all surveys. params: { status? } */
  list: (params) => api.get('/surveys/', { params }),
  /** Employee: pending surveys not yet responded to. */
  myPending: () => api.get('/surveys/my-pending'),
  /** Employee: submit anonymous response. body: { answers: [{question_id, score?, comment?}] } */
  respond: (surveyId, body) => api.post(`/surveys/${surveyId}/respond`, body),
  /** Admin: anonymized results. params: { survey_id? } */
  results: (params) => api.get('/surveys/results', { params }),
  /** Admin: engagement trend data. params: { weeks? } */
  engagementTrends: (params) => api.get('/surveys/engagement-trends', { params }),
}

// ── Growth Events API ────────────────────────────────────────────────────────
export const growthEventsAPI = {
  /** Admin: create growth event. */
  create: (body) => api.post('/experience/growth/events', body),
  /** Admin: list growth events. params: { status? } */
  list: (params) => api.get('/experience/growth/events', { params }),
  /** Admin: update a growth event. */
  update: (eventId, body) => api.put(`/experience/growth/events/${eventId}`, body),
  /** Admin: delete a growth event. */
  delete: (eventId) => api.delete(`/experience/growth/events/${eventId}`),
  /** Admin: get registrations (leads) as JSON. */
  getRegistrations: (eventId) => api.get(`/experience/growth/events/${eventId}/registrations`),
  /** Admin: download registrations as CSV (returns URL for download). */
  getCsvUrl: (eventId) => `/api/experience/growth/events/${eventId}/registrations/csv`,
}

export default api
