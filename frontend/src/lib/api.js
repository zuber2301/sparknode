import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
    
    // Add tenant context header for explicit tenant isolation
    // But only if it's a valid UUID (not the zero/null UUID)
    if (tenantId && tenantId !== '00000000-0000-0000-0000-000000000000') {
      config.headers['X-Tenant-ID'] = tenantId
    }
    
    // DEBUG: Log department requests
    if (config.url.includes('departments')) {
      console.log('[API] Departments request:', {
        url: config.url,
        user: state.user,
        tenantContext: state.tenantContext,
        tenantId: tenantId,
        'X-Tenant-ID': config.headers['X-Tenant-ID'],
        isSent: !!config.headers['X-Tenant-ID']
      })
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
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh'),
  requestEmailOtp: (email, tenant_id) => api.post('/auth/otp/email/request', { email, tenant_id }),
  verifyEmailOtp: (email, code, tenant_id) => api.post('/auth/otp/email/verify', { email, code, tenant_id }),
  requestSmsOtp: (mobile_number, tenant_id) => api.post('/auth/otp/sms/request', { mobile_number, tenant_id }),
  verifySmsOtp: (mobile_number, code, tenant_id) => api.post('/auth/otp/sms/verify', { mobile_number, code, tenant_id }),
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
}

// Redemption API
export const redemptionAPI = {
  getBrands: (params) => api.get('/redemptions/brands', { params }),
  getCategories: () => api.get('/redemptions/brands/categories'),
  getVouchers: (params) => api.get('/redemptions/vouchers', { params }),
  getVoucherById: (id) => api.get(`/redemptions/vouchers/${id}`),
  create: (data) => api.post('/redemptions', data),
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
  updateCurrent: (data) => api.put('/tenants/current', data),
  getDepartments: () => api.get('/tenants/departments'),
  createDepartment: (data) => api.post('/tenants/departments', data),
  updateDepartment: (id, data) => api.put(`/tenants/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/tenants/departments/${id}`),
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
  getTenants: (params) => api.get('/platform/tenants', { params }),
  getTenantById: (tenantId) => api.get(`/platform/tenants/${tenantId}`),
  createTenant: (data) => api.post('/platform/tenants', data),
  updateTenant: (tenantId, data) => api.put(`/platform/tenants/${tenantId}`, data),
  suspendTenant: (tenantId, reason) => api.post(`/platform/tenants/${tenantId}/suspend`, null, { params: { reason } }),
  activateTenant: (tenantId) => api.post(`/platform/tenants/${tenantId}/activate`),
  updateSubscription: (tenantId, data) => api.put(`/platform/tenants/${tenantId}/subscription`, data),
  getSubscriptionTiers: () => api.get('/platform/subscription-tiers'),
  getFeatureFlags: (tenantId) => api.get(`/platform/tenants/${tenantId}/feature_flags`),
  updateFeatureFlags: (tenantId, data) => api.patch(`/platform/tenants/${tenantId}/feature_flags`, data),
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
