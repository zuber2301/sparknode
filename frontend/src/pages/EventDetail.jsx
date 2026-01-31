import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventsAPI } from '../lib/eventsAPI'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  HiOutlineChevronLeft,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineUsers,
  HiOutlineCalendar,
  HiOutlinePencil,
} from 'react-icons/hi'

export default function EventDetail() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [nominationFilter, setNominationFilter] = useState('all')

  // Fetch event details
  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsAPI.getById(eventId),
  })

  // Fetch activities
  const { data: activities = [] } = useQuery({
    queryKey: ['eventActivities', eventId],
    queryFn: () => eventsAPI.getActivities(eventId),
    enabled: !!eventId,
  })

  // Fetch nominations
  const { data: nominations = [] } = useQuery({
    queryKey: ['eventNominations', eventId, nominationFilter],
    queryFn: () => eventsAPI.getNominations(eventId, { status: nominationFilter === 'all' ? undefined : nominationFilter }),
    enabled: !!eventId,
  })

  // Fetch metrics
  const { data: metrics } = useQuery({
    queryKey: ['eventMetrics', eventId],
    queryFn: () => eventsAPI.getMetrics(eventId),
    enabled: !!eventId,
  })

  // Approve/Reject nomination
  const updateNominationMutation = useMutation({
    mutationFn: ({ nominationId, status, notes }) =>
      eventsAPI.updateNomination(eventId, nominationId, { status, notes }),
    onSuccess: () => {
      toast.success('Nomination updated')
      queryClient.invalidateQueries(['eventNominations', eventId])
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update nomination')
    },
  })

  const handleApproveNomination = (nominationId) => {
    updateNominationMutation.mutate({ nominationId, status: 'approved' })
  }

  const handleRejectNomination = (nominationId) => {
    updateNominationMutation.mutate({ nominationId, status: 'rejected' })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sparknode-purple"></div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Event not found</p>
        <button onClick={() => navigate('/events')} className="mt-4 text-sparknode-purple hover:text-sparknode-purple/80">
          ← Back to Events
        </button>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', name: 'Overview' },
    { id: 'activities', name: 'Activities', count: activities.length },
    { id: 'nominations', name: 'Nominations', count: nominations.length },
    { id: 'budget', name: 'Budget' },
    { id: 'reports', name: 'Reports' },
  ]

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-800',
      published: 'bg-blue-100 text-blue-800',
      ongoing: 'bg-green-100 text-green-800',
      closed: 'bg-red-100 text-red-800',
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  const getNominationBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      waitlisted: 'bg-blue-100 text-blue-800',
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/events')}
          className="text-sm text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-1"
        >
          <HiOutlineChevronLeft className="w-4 h-4" />
          Back to Events
        </button>

        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
              <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(event.status)}`}>
                {event.status.toUpperCase()}
              </span>
            </div>
            <p className="text-gray-600">{event.description}</p>
          </div>
          <button
            onClick={() => navigate(`/events/${eventId}/edit`)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <HiOutlinePencil className="w-5 h-5" />
            Edit
          </button>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase">Duration</div>
            <div className="text-sm text-gray-900 mt-1 flex items-center gap-1">
              <HiOutlineCalendar className="w-4 h-4" />
              {format(new Date(event.start_datetime), 'MMM d')} - {format(new Date(event.end_datetime), 'MMM d, yyyy')}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase">Location</div>
            <div className="text-sm text-gray-900 mt-1">
              {event.venue || event.location || 'TBD'}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase">Activities</div>
            <div className="text-2xl font-bold text-sparknode-purple mt-1">{activities.length}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase">Registrations</div>
            <div className="text-2xl font-bold text-sparknode-purple mt-1">
              {metrics?.total_registered || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'text-sparknode-purple border-sparknode-purple'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              {tab.name}
              {tab.count !== undefined && (
                <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Event Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">Type</div>
                    <div className="text-sm text-gray-900 mt-1">{event.type}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">Format</div>
                    <div className="text-sm text-gray-900 mt-1 capitalize">{event.format}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">Visibility</div>
                    <div className="text-sm text-gray-900 mt-1 capitalize">{event.visibility}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">Budget</div>
                    <div className="text-sm text-gray-900 mt-1">
                      {event.currency} {event.planned_budget}
                    </div>
                  </div>
                </div>
              </div>

              <hr />

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Nomination Period</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">Nomination Start</div>
                    <div className="text-sm text-gray-900 mt-1">
                      {format(new Date(event.nomination_start), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">Nomination End</div>
                    <div className="text-sm text-gray-900 mt-1">
                      {format(new Date(event.nomination_end), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activities' && (
            <div className="space-y-4">
              {activities.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No activities added yet</p>
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{activity.name}</div>
                        {activity.description && (
                          <div className="text-sm text-gray-600 mt-1">{activity.description}</div>
                        )}
                        <div className="text-xs text-gray-500 mt-2 space-x-2">
                          <span className="inline-block px-2 py-1 bg-white rounded border border-gray-200">
                            {activity.category}
                          </span>
                          {activity.requires_approval && (
                            <span className="inline-block px-2 py-1 bg-white rounded border border-gray-200">
                              Requires Approval
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'nominations' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-2 mb-4">
                {['all', 'pending', 'approved', 'rejected'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setNominationFilter(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                      nominationFilter === status
                        ? 'bg-sparknode-purple text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {nominations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No nominations found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {nominations.map((nomination) => (
                    <div key={nomination.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{nomination.nominee_user_id}</div>
                          {nomination.performance_title && (
                            <div className="text-sm text-gray-600 mt-1">{nomination.performance_title}</div>
                          )}
                          <div className="text-xs text-gray-500 mt-2">
                            Nominated by: {nomination.created_by}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getNominationBadge(nomination.status)}`}>
                            {nomination.status}
                          </span>
                          {nomination.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveNomination(nomination.id)}
                                disabled={updateNominationMutation.isPending}
                                className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                              >
                                <HiOutlineCheckCircle className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleRejectNomination(nomination.id)}
                                disabled={updateNominationMutation.isPending}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              >
                                <HiOutlineXCircle className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'budget' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white rounded-lg p-6">
                <div className="text-sm opacity-90">Planned Budget</div>
                <div className="text-4xl font-bold mt-2">
                  {event.currency} {event.planned_budget.toLocaleString()}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-600">
                  Budget tracking and expense details coming soon
                </p>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Event Analytics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs font-medium text-gray-500 uppercase">Total Registrations</div>
                    <div className="text-2xl font-bold text-sparknode-purple mt-2">
                      {metrics?.total_registered || 0}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs font-medium text-gray-500 uppercase">Total Nominations</div>
                    <div className="text-2xl font-bold text-sparknode-purple mt-2">
                      {nominations.length}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs font-medium text-gray-500 uppercase">Approved</div>
                    <div className="text-2xl font-bold text-green-600 mt-2">
                      {nominations.filter(n => n.status === 'approved').length}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs font-medium text-gray-500 uppercase">Pending</div>
                    <div className="text-2xl font-bold text-yellow-600 mt-2">
                      {nominations.filter(n => n.status === 'pending').length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-600">
                  Detailed analytics and reporting features coming soon
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
