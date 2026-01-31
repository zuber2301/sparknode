import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { eventsAPI } from '../lib/eventsAPI'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineEye,
  HiOutlineCalendar,
  HiOutlineUsers,
  HiOutlineChevronDown,
} from 'react-icons/hi'

export default function Events() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  // Fetch events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', { status: statusFilter }],
    queryFn: () => eventsAPI.getAll({ status: statusFilter }),
  })

  // Delete event
  const deleteMutation = useMutation({
    mutationFn: (eventId) => eventsAPI.delete(eventId),
    onSuccess: () => {
      toast.success('Event deleted successfully')
      queryClient.invalidateQueries(['events'])
      setSelectedEvent(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to delete event')
    },
  })

  const handleCreateEvent = () => {
    navigate('/events/create')
  }

  const handleViewEvent = (eventId) => {
    navigate(`/events/${eventId}`)
  }

  const handleEditEvent = (eventId) => {
    navigate(`/events/${eventId}/edit`)
  }

  const handleDeleteEvent = (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      deleteMutation.mutate(eventId)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-800',
      published: 'bg-blue-100 text-blue-800',
      ongoing: 'bg-green-100 text-green-800',
      closed: 'bg-red-100 text-red-800',
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const eventStats = {
    total: events.length,
    draft: events.filter(e => e.status === 'draft').length,
    published: events.filter(e => e.status === 'published').length,
    ongoing: events.filter(e => e.status === 'ongoing').length,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sparknode-purple"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events Hub</h1>
          <p className="text-gray-500 mt-1">Create and manage company events and activities</p>
        </div>
        <button
          onClick={handleCreateEvent}
          className="btn btn-primary flex items-center gap-2"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Create Event
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Total Events</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{eventStats.total}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Draft</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{eventStats.draft}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Published</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">{eventStats.published}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Ongoing</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{eventStats.ongoing}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === null
              ? 'bg-sparknode-purple text-white'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          All Events
        </button>
        {['draft', 'published', 'ongoing', 'closed'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              statusFilter === status
                ? 'bg-sparknode-purple text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <HiOutlineCalendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No events found</p>
            <button
              onClick={handleCreateEvent}
              className="mt-4 text-sparknode-purple hover:text-sparknode-purple/80 font-medium"
            >
              Create your first event
            </button>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-lg border border-gray-200 hover:border-sparknode-purple/30 transition-colors p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                    <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(event.status)}`}>
                      {getStatusLabel(event.status)}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{event.description}</p>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <HiOutlineCalendar className="w-4 h-4" />
                      {format(new Date(event.start_datetime), 'MMM d, yyyy')} - {format(new Date(event.end_datetime), 'MMM d, yyyy')}
                    </div>
                    {event.activity_count > 0 && (
                      <div className="flex items-center gap-1">
                        <HiOutlineUsers className="w-4 h-4" />
                        {event.activity_count} activities
                      </div>
                    )}
                    {event.nomination_count > 0 && (
                      <div className="flex items-center gap-1">
                        <HiOutlineUsers className="w-4 h-4" />
                        {event.nomination_count} nominations
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleViewEvent(event.id)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View"
                  >
                    <HiOutlineEye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEditEvent(event.id)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <HiOutlinePencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <HiOutlineTrash className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
