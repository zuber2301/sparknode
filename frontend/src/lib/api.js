import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// Use a relative API base by default so the SPA can be served from the same origin
// and API requests go through the nginx proxy at `/api`. During local development
// set `VITE_API_URL` to an absolute URL if needed (e.g. http://localhost:7100).
const API_URL = import.meta.env.VITE_API_URL || ''

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
      useAuthStore.getState().logout()
      window.location.href = '/login'
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
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh'),
  requestEmailOtp: (email, tenant_id) => api.post('/auth/otp/email/request', { email, tenant_id }),
  verifyEmailOtp: (email, code, tenant_id) => api.post('/auth/otp/email/verify', { email, code, tenant_id }),
  requestSmsOtp: (mobile_number, tenant_id) => api.post('/auth/otp/sms/request', { mobile_number, tenant_id }),
  verifySmsOtp: (mobile_number, code, tenant_id) => api.post('/auth/otp/sms/verify', { mobile_number, code, tenant_id }),
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
  getLeadBudgets: (id) => api.get(`/budgets/${id}/leads`),
  allocateLeadBudget: (data) => api.post('/budgets/leads/allocate', data),
  activate: (id) => api.put(`/budgets/${id}/activate`),
  getUtilization: (id) => api.get(`/budgets/${id}/utilization`),
  getPool: () => api.get('/budgets/pool'),
}

// Recognition API
export const recognitionAPI = {
  getAll: (params) => api.get('/recognitions', { params }),
  getById: (id) => api.get(`/recognitions/${id}`),
  create: (data) => api.post('/recognitions', data),
  getBadges: () => api.get('/recognitions/badges'),
  toggleReaction: (id) => api.post(`/recognitions/${id}/react`),
  getComments: (id) => api.get(`/recognitions/${id}/comments`),
  addComment: (id, data) => api.post(`/recognitions/${id}/comments`, data),
  getMyStats: () => api.get('/recognitions/stats/me'),
  getUserStats: (userId) => api.get(`/recognitions/stats/${userId}`),
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
  publish: (id) => api.put(`/events/${id}/publish`),
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

// Alias exports for component compatibility
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

export default api
