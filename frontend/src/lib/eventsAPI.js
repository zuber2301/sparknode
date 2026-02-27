/**
 * Events API — uses the centralized api client from api.js
 * to ensure auth tokens and X-Tenant-ID headers are always sent.
 */
import api from './api'

export const eventsAPI = {
  // Event Templates
  getTemplates: async () => {
    const response = await api.get('/events/templates')
    return response.data
  },

  // Events CRUD
  getAll: async (filters = {}) => {
    const response = await api.get('/events', { params: filters })
    return response.data
  },

  getById: async (eventId) => {
    const response = await api.get(`/events/${eventId}`)
    return response.data
  },

  create: async (data) => {
    const response = await api.post('/events', data)
    return response.data
  },

  update: async (eventId, data) => {
    const response = await api.put(`/events/${eventId}`, data)
    return response.data
  },

  delete: async (eventId) => {
    const response = await api.delete(`/events/${eventId}`)
    return response.data
  },

  // Activities
  createActivity: async (eventId, data) => {
    const response = await api.post(`/events/${eventId}/activities`, data)
    return response.data
  },

  getActivities: async (eventId) => {
    const response = await api.get(`/events/${eventId}/activities`)
    return response.data
  },

  updateActivity: async (eventId, activityId, data) => {
    const response = await api.put(`/events/${eventId}/activities/${activityId}`, data)
    return response.data
  },

  deleteActivity: async (eventId, activityId) => {
    const response = await api.delete(`/events/${eventId}/activities/${activityId}`)
    return response.data
  },

  // Nominations
  createNomination: async (eventId, activityId, data) => {
    const response = await api.post(`/events/${eventId}/activities/${activityId}/nominate`, data)
    return response.data
  },

  getNominations: async (eventId, filters = {}) => {
    const response = await api.get(`/events/${eventId}/nominations`, { params: filters })
    return response.data
  },

  updateNomination: async (eventId, nominationId, data) => {
    const response = await api.put(`/events/${eventId}/nominations/${nominationId}/approve`, data)
    return response.data
  },

  bulkApprovaNominations: async (data) => {
    const response = await api.post('/events/nominations/bulk-approve', data)
    return response.data
  },

  // Metrics
  getMetrics: async (eventId) => {
    const response = await api.get(`/events/${eventId}/metrics`)
    return response.data
  },
}
