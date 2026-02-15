import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { eventsAPI } from '../lib/eventsAPI'
import { salesAPI } from '../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  HiOutlineChevronRight,
  HiOutlineChevronLeft,
  HiOutlinePlus,
  HiOutlineX,
  HiOutlineTrash,
} from 'react-icons/hi'

export default function EventCreateWizard({ editingEventId = null }) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'general',
    start_datetime: '',
    end_datetime: '',
    venue: '',
    location: '',
    format: 'online',
    banner_url: '',
    color_code: '#7c3aed',
    status: 'draft',
    visibility: 'all_employees',
    visible_to_departments: [],
    nomination_start: '',
    nomination_end: '',
    who_can_nominate: 'all_employees',
    max_activities_per_person: 2,
    planned_budget: 0,
    currency: 'USD',
  })
  const [activities, setActivities] = useState([])
  const [newActivity, setNewActivity] = useState({
    name: '',
    description: '',
    category: 'solo',
    max_participants: null,
    requires_approval: true,
  })

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [salesCreated, setSalesCreated] = useState(null)

  // Fetch event templates for quick start
  const { data: templates = [] } = useQuery({
    queryKey: ['eventTemplates'],
    queryFn: () => eventsAPI.getTemplates(),
  })

  // Fetch existing event if editing
  const { data: existingEvent } = useQuery({
    queryKey: ['event', editingEventId],
    queryFn: () => eventsAPI.getById(editingEventId),
    enabled: !!editingEventId,
    onSuccess: (event) => {
      setFormData(event)
    },
  })

  const createMutation = useMutation({
    mutationFn: (data) => {
      // If creating a Sales Event (Sales & Marketing module), use salesAPI
      if (data.is_sales_event) {
        // Map form fields to API fields for sales events
        const salesPayload = {
          name: data.title,
          description: data.description,
          event_type: data.type,
          start_at: new Date(data.start_datetime).toISOString(),
          end_at: new Date(data.end_datetime).toISOString(),
          owner_user_id: data.owner_user_id,
          marketing_owner_id: data.marketing_owner_id,
          target_registrations: data.target_registrations,
          target_pipeline: data.target_pipeline,
          target_revenue: data.target_revenue,
        }
        if (editingEventId) return salesAPI.update(editingEventId, salesPayload)
        return salesAPI.create(salesPayload)
      }
      if (editingEventId) {
        return eventsAPI.update(editingEventId, data)
      }
      return eventsAPI.create(data)
    },
    onSuccess: (newEvent) => {
      toast.success(editingEventId ? 'Event updated successfully' : 'Event created successfully')
      queryClient.invalidateQueries(['events'])
      // If this was a sales event, keep the created event in state to allow publishing
      if (newEvent.registration_url || newEvent.event_type === 'campaign' || newEvent.status) {
        setSalesCreated(newEvent)
      } else {
        navigate(`/events/${newEvent.id}`)
      }
    },
    onError: (error) => {
      const detail = error.response?.data?.detail || error.message || 'Failed to create event'
      console.error('Create event error:', error)
      toast.error(typeof detail === 'string' ? detail : JSON.stringify(detail))
    },
  })

  const handleUseTemplate = (template) => {
    setFormData((prev) => ({
      ...prev,
      type: template.id,
    }))
    setActivities(template.preset_activities || [])
  }

  const handleAddActivity = () => {
    if (!newActivity.name.trim()) {
      toast.error('Activity name is required')
      return
    }
    setActivities([...activities, { ...newActivity, id: Date.now() }])
    setNewActivity({
      name: '',
      description: '',
      category: 'solo',
      max_participants: null,
      requires_approval: true,
    })
  }

  const handleRemoveActivity = (id) => {
    setActivities(activities.filter((a) => a.id !== id))
  }

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Event title is required')
      return
    }
    if (!formData.start_datetime || !formData.end_datetime) {
      toast.error('Event dates are required')
      return
    }
    if (formData.is_sales_event) {
      if (!formData.type) {
        toast.error('Event type is required')
        return
      }
    } else {
      if (!formData.nomination_start || !formData.nomination_end) {
        toast.error('Nomination dates are required')
        return
      }
      if (activities.length === 0) {
        toast.error('At least one activity is required')
        return
      }
    }

    const submitData = { ...formData }
    createMutation.mutate(submitData)
  }

  const publishMutation = useMutation({
    mutationFn: ({ eventId }) => salesAPI.publish(eventId),
    onSuccess: (resp) => {
      toast.success('Event published')
      if (salesCreated) {
        setSalesCreated((s) => ({ ...s, registration_url: resp.registration_url, status: 'published' }))
      }
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Publish failed')
  })

  const steps = [
    { number: 1, name: 'Basics' },
    { number: 2, name: 'Activities' },
    { number: 3, name: 'Registration' },
    { number: 4, name: 'Budget' },
  ]

  const isStepValid = () => {
    switch (step) {
      case 1:
        return formData.title.trim() && formData.start_datetime && formData.end_datetime
      case 2:
        return activities.length > 0
      case 3:
        return formData.nomination_start && formData.nomination_end
      case 4:
        return formData.planned_budget >= 0
      default:
        return true
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/events')}
          className="text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          ← Back to Events
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {editingEventId ? 'Edit Event' : 'Create New Event'}
        </h1>
      </div>

      {/* Sales Event publish banner */}
      {salesCreated && (
        <div className="mb-4 p-4 bg-white border rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-700">Sales Event created:</div>
              <div className="font-medium">{salesCreated.name || salesCreated.title}</div>
              <div className="text-xs text-gray-500">Registration URL: {salesCreated.registration_url || 'Not published yet'}</div>
            </div>
            <div className="flex items-center gap-2">
              {!salesCreated.registration_url && (
                <button onClick={() => publishMutation.mutate({ eventId: salesCreated.id })} className="btn-primary">Publish</button>
              )}
              {salesCreated.registration_url && (
                <a href={salesCreated.registration_url} target="_blank" rel="noreferrer" className="btn-secondary">Open Registration</a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, idx) => (
            <div key={s.number} className="flex items-center flex-1">
              <button
                onClick={() => setStep(s.number)}
                className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-colors ${
                  step >= s.number
                    ? 'bg-sparknode-purple text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {s.number}
              </button>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">{s.name}</div>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-4 ${step > s.number ? 'bg-sparknode-purple' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Event Basics</h2>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_sales_event"
                  checked={!!formData.is_sales_event}
                  onChange={(e) => setFormData({ ...formData, is_sales_event: e.target.checked })}
                />
                <label htmlFor="is_sales_event" className="text-sm text-gray-700">Create as Sales & Marketing Event</label>
              </div>

              {/* Quick Templates */}
              {templates.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Quick Start with Template
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {templates?.templates?.slice(0, 3).map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleUseTemplate(template)}
                        className="p-4 border border-gray-200 rounded-lg hover:border-sparknode-purple hover:bg-sparknode-purple/5 transition-all text-left"
                      >
                        <div className="text-2xl mb-2">{template.icon}</div>
                        <div className="font-medium text-gray-900">{template.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{template.description}</div>
                      </button>
                    ))}
                  </div>
                  <hr className="my-6" />
                </div>
              )}

              {/* Form Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., Annual Day 2026"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input w-full"
                  rows="3"
                  placeholder="Describe your event..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="input w-full"
                  >
                    <option value="general">General</option>
                    <option value="celebration">Celebration</option>
                    <option value="sports">Sports</option>
                    <option value="competition">Competition</option>
                    <option value="campaign">Campaign</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Format *
                  </label>
                  <select
                    value={formData.format}
                    onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                    className="input w-full"
                  >
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.start_datetime}
                    onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.end_datetime}
                    onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Venue
                  </label>
                  <input
                    type="text"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    className="input w-full"
                    placeholder="e.g., Conference Hall A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input w-full"
                    placeholder="e.g., Bangalore, India"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Theme
                </label>
                <input
                  type="color"
                  value={formData.color_code}
                  onChange={(e) => setFormData({ ...formData, color_code: e.target.value })}
                  className="w-12 h-10 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Event Activities</h2>

              {/* Existing Activities */}
              {activities.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Activities ({activities.length})
                  </label>
                  <div className="space-y-2">
                    {activities.map((activity, idx) => (
                      <div
                        key={activity.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-start justify-between"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{activity.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {activity.category === 'solo' && 'Solo activity'}
                            {activity.category === 'group' && 'Group activity'}
                            {activity.category === 'other' && 'Other'}
                            {activity.requires_approval && ' • Requires approval'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveActivity(activity.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors ml-2"
                        >
                          <HiOutlineTrash className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Activity Form */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-4">Add Activity</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Activity Name *
                    </label>
                    <input
                      type="text"
                      value={newActivity.name}
                      onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                      className="input w-full"
                      placeholder="e.g., Singing, Sports, Gift Pickup"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newActivity.description}
                      onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                      className="input w-full"
                      rows="2"
                      placeholder="Describe the activity..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category *
                      </label>
                      <select
                        value={newActivity.category}
                        onChange={(e) => setNewActivity({ ...newActivity, category: e.target.value })}
                        className="input w-full"
                      >
                        <option value="solo">Solo</option>
                        <option value="group">Group</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <input
                          type="checkbox"
                          checked={newActivity.requires_approval}
                          onChange={(e) => setNewActivity({ ...newActivity, requires_approval: e.target.checked })}
                          className="mr-2"
                        />
                        Requires Approval
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={handleAddActivity}
                    className="btn btn-secondary flex items-center gap-2 w-full justify-center"
                  >
                    <HiOutlinePlus className="w-5 h-5" />
                    Add Activity
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Nomination Settings</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nomination Start Date *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.nomination_start}
                    onChange={(e) => setFormData({ ...formData, nomination_start: e.target.value })}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nomination End Date *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.nomination_end}
                    onChange={(e) => setFormData({ ...formData, nomination_end: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Who Can Nominate
                </label>
                <select
                  value={formData.who_can_nominate}
                  onChange={(e) => setFormData({ ...formData, who_can_nominate: e.target.value })}
                  className="input w-full"
                >
                  <option value="all_employees">All Employees</option>
                  <option value="managers">Managers Only</option>
                  <option value="self_only">Self Nomination Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Activities Per Person
                </label>
                <input
                  type="number"
                  value={formData.max_activities_per_person}
                  onChange={(e) => setFormData({ ...formData, max_activities_per_person: parseInt(e.target.value) })}
                  className="input w-full"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Visibility
                </label>
                <select
                  value={formData.visibility}
                  onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                  className="input w-full"
                >
                  <option value="all_employees">All Employees</option>
                  <option value="specific_departments">Specific Departments</option>
                  <option value="invited_only">Invited Only</option>
                </select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Budget Details</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Planned Budget *
                  </label>
                  <input
                    type="number"
                    value={formData.planned_budget}
                    onChange={(e) => setFormData({ ...formData, planned_budget: parseFloat(e.target.value) })}
                    className="input w-full"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="input w-full"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="input w-full"
                >
                  <option value="draft">Draft (Not Published)</option>
                  <option value="published">Published (Live)</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Summary:</strong> {formData.title || 'Untitled Event'} with {activities.length} activities and {formData.currency} {formData.planned_budget}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            className="btn btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HiOutlineChevronLeft className="w-5 h-5" />
            Previous
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!isStepValid()}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <HiOutlineChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || !isStepValid()}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Creating...' : editingEventId ? 'Update Event' : 'Create Event'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
