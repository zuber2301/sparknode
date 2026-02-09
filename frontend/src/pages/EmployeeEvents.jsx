import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventsAPI } from '../lib/eventsAPI'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  HiOutlineCalendar,
  HiOutlineUsers,
  HiOutlineCheckCircle,
  HiOutlineClipboardList,
  HiOutlineExclamationCircle,
} from 'react-icons/hi'

export default function EmployeeEvents() {
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [nominationForm, setNominationForm] = useState({
    performance_title: '',
    notes: '',
  })
  const [showNominationModal, setShowNominationModal] = useState(false)
  const queryClient = useQueryClient()

  // Fetch published events only
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['publishedEvents'],
    queryFn: () => eventsAPI.getAll({ status: 'published' }),
  })

  // Fetch activities for selected event
  const { data: activities = [] } = useQuery({
    queryKey: ['eventActivities', selectedEvent?.id],
    queryFn: () => eventsAPI.getActivities(selectedEvent.id),
    enabled: !!selectedEvent,
  })

  // Create nomination
  const createNominationMutation = useMutation({
    mutationFn: (data) =>
      eventsAPI.createNomination(selectedEvent.id, selectedActivity.id, data),
    onSuccess: () => {
      toast.success('Nomination submitted successfully!')
      setShowNominationModal(false)
      setNominationForm({ performance_title: '', notes: '' })
      setSelectedActivity(null)
      queryClient.invalidateQueries(['eventActivities', selectedEvent?.id])
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to submit nomination')
    },
  })

  const handleSubmitNomination = () => {
    if (!nominationForm.performance_title.trim() && selectedActivity.category === 'solo') {
      toast.error('Performance title is required')
      return
    }
    createNominationMutation.mutate(nominationForm)
  }

  const isNominationWindowOpen = (activity) => {
    const now = new Date()
    const startOpen = !activity.nomination_start || new Date(activity.nomination_start) <= now
    const endOpen = !activity.nomination_end || new Date(activity.nomination_end) >= now
    return startOpen && endOpen
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Events</h1>
        <p className="text-gray-600 mt-1">Browse and participate in company events</p>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-lg border border-gray-200">
            <HiOutlineCalendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No events available</p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              className={`bg-white rounded-lg border-2 transition-all cursor-pointer p-5 ${
                selectedEvent?.id === event.id
                  ? 'border-sparknode-purple shadow-lg'
                  : 'border-gray-200 hover:border-sparknode-purple/30'
              }`}
            >
              {/* Color accent */}
              <div
                className="w-full h-2 rounded-full mb-4"
                style={{ backgroundColor: event.color_code || '#7c3aed' }}
              />

              <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
              <p className="text-sm text-gray-600 mt-2">{event.description}</p>

              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <HiOutlineCalendar className="w-4 h-4" />
                  {format(new Date(event.start_datetime), 'MMM d')} -{' '}
                  {format(new Date(event.end_datetime), 'MMM d, yyyy')}
                </div>

                <div className="flex items-center gap-2">
                  <HiOutlineUsers className="w-4 h-4" />
                  {event.activity_count} activities
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedEvent(event)
                }}
                className="mt-4 w-full bg-sparknode-purple text-white rounded-lg py-2 hover:bg-sparknode-purple/90 transition-colors text-sm font-medium"
              >
                View Activities
              </button>
            </div>
          ))
        )}
      </div>

      {/* Selected Event Details */}
      {selectedEvent && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedEvent.title}</h2>
              <p className="text-gray-600 mt-1">{selectedEvent.description}</p>
            </div>
            <button
              onClick={() => {
                setSelectedEvent(null)
                setSelectedActivity(null)
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase">Event Type</div>
                <div className="text-sm font-semibold text-gray-900 mt-1 capitalize">{selectedEvent.type}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase">Format</div>
                <div className="text-sm font-semibold text-gray-900 mt-1 capitalize">{selectedEvent.format}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase">Venue</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{selectedEvent.venue || 'TBD'}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase">Location</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{selectedEvent.location || 'TBD'}</div>
              </div>
            </div>
          </div>

          {/* Activities */}
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activities & Nominations</h3>
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <HiOutlineClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>No activities added yet</p>
              </div>
            ) : (
              activities.map((activity) => {
                const windowOpen = isNominationWindowOpen(activity)
                return (
                  <div
                    key={activity.id}
                    className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:border-sparknode-purple/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{activity.name}</h4>
                        {activity.description && (
                          <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-block px-2.5 py-1 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700">
                            {activity.category === 'solo' && '👤 Solo'}
                            {activity.category === 'group' && '👥 Group'}
                            {activity.category === 'other' && '📌 Other'}
                          </span>

                          {activity.requires_approval && (
                            <span className="inline-block px-2.5 py-1 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700">
                              ✓ Requires Approval
                            </span>
                          )}

                          {!windowOpen && (
                            <span className="inline-block px-2.5 py-1 bg-red-50 border border-red-200 rounded text-xs font-medium text-red-700">
                              Nomination Closed
                            </span>
                          )}
                        </div>

                        <div className="mt-3 text-xs text-gray-500">
                          {activity.nomination_start && (
                            <div>
                              Nominations open:{' '}
                              {format(new Date(activity.nomination_start), 'MMM d, HH:mm')} -
                              {activity.nomination_end && (
                                <> {format(new Date(activity.nomination_end), 'MMM d, HH:mm')}</>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {windowOpen && (
                        <button
                          onClick={() => {
                            setSelectedActivity(activity)
                            setShowNominationModal(true)
                          }}
                          className="ml-4 btn btn-primary text-sm whitespace-nowrap"
                        >
                          Nominate
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Nomination Modal */}
      {showNominationModal && selectedActivity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Nominate for {selectedActivity.name}
            </h3>

            <div className="space-y-4">
              {selectedActivity.category === 'solo' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Performance Title / Role *
                  </label>
                  <input
                    type="text"
                    value={nominationForm.performance_title}
                    onChange={(e) =>
                      setNominationForm({ ...nominationForm, performance_title: e.target.value })
                    }
                    className="input w-full"
                    placeholder="e.g., Song performance, Comedy act"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={nominationForm.notes}
                  onChange={(e) => setNominationForm({ ...nominationForm, notes: e.target.value })}
                  className="input w-full"
                  rows="3"
                  placeholder="Any additional information..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p>
                  {selectedActivity.requires_approval
                    ? '✓ Your nomination will be reviewed and approved by the organizers.'
                    : '✓ Your nomination will be automatically confirmed.'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowNominationModal(false)
                  setSelectedActivity(null)
                  setNominationForm({ performance_title: '', notes: '' })
                }}
                className="flex-1 btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitNomination}
                disabled={createNominationMutation.isPending}
                className="flex-1 btn btn-primary disabled:opacity-50"
              >
                {createNominationMutation.isPending ? 'Submitting...' : 'Submit Nomination'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
