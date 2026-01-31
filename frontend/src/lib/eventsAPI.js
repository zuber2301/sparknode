import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${API_URL}/api/events`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

export const eventsAPI = {
  // Event Templates
  getTemplates: async () => {
    const response = await api.get('/templates')
    return response.data
  },

  // Events CRUD
  getAll: async (filters = {}) => {
    const response = await api.get('/', { params: filters })
    return response.data
  },

  getById: async (eventId) => {
    const response = await api.get(`/${eventId}`)
    return response.data
  },

  create: async (data) => {
    const response = await api.post('/', data)
    return response.data
  },

  update: async (eventId, data) => {
    const response = await api.put(`/${eventId}`, data)
    return response.data
  },

  delete: async (eventId) => {
    const response = await api.delete(`/${eventId}`)
    return response.data
  },

  // Activities
  createActivity: async (eventId, data) => {
    const response = await api.post(`/${eventId}/activities`, data)
    return response.data
  },

  getActivities: async (eventId) => {
    const response = await api.get(`/${eventId}/activities`)
    return response.data
  },

  updateActivity: async (eventId, activityId, data) => {
    const response = await api.put(`/${eventId}/activities/${activityId}`, data)
    return response.data
  },

  deleteActivity: async (eventId, activityId) => {
    const response = await api.delete(`/${eventId}/activities/${activityId}`)
    return response.data
  },

  // Nominations
  createNomination: async (eventId, activityId, data) => {
    const response = await api.post(`/${eventId}/activities/${activityId}/nominate`, data)
    return response.data
  },

  getNominations: async (eventId, filters = {}) => {
    const response = await api.get(`/${eventId}/nominations`, { params: filters })
    return response.data
  },

  updateNomination: async (eventId, nominationId, data) => {
    const response = await api.put(`/${eventId}/nominations/${nominationId}/approve`, data)
    return response.data
  },

  bulkApprovaNominations: async (data) => {
    const response = await api.post('/nominations/bulk-approve', data)
    return response.data
  },

  // Metrics
  getMetrics: async (eventId) => {
    const response = await api.get(`/${eventId}/metrics`)
    return response.data
  },
}
