import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { eventsAPI } from '../lib/eventsAPI'
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
      if (editingEventId) {
        return eventsAPI.update(editingEventId, data)
      }
      return eventsAPI.create(data)
    },
    onSuccess: (newEvent) => {
      toast.success(editingEventId ? 'Event updated successfully' : 'Event created successfully')
      queryClient.invalidateQueries(['events'])
      navigate(`/events/${newEvent.id}`)
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

    const submitData = { ...formData }
    createMutation.mutate(submitData)
  }

  const publishMutation = useMutation({
    mutationFn: ({ eventId }) => eventsAPI.publish(eventId),
    onSuccess: () => {
      toast.success('Event published successfully')
      queryClient.invalidateQueries(['events'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to publish event')
    },
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
        return true // Activities are optional
      case 3:
        return true // Nomination dates are optional
      case 4:
        return formData.planned_budget >= 0
      default:
        return true
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row gap-12 items-start">
        {/* Left Navigation Sidebar - Modern Stacked Style */}
        <aside className="w-full md:w-72 shrink-0 md:sticky md:top-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 bg-gray-50/50 border-b border-gray-100">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Creation Workflow</h3>
            </div>
            <nav className="p-3 space-y-2">
              {steps.map((s) => {
                const isActive = step === s.number
                const isCompleted = step > s.number
                const isLocked = s.number > step && !isStepValid()

                return (
                  <button
                    key={s.number}
                    onClick={() => (!isLocked || isCompleted) && setStep(s.number)}
                    disabled={isLocked}
                    className={`w-full group flex items-center px-4 py-4 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-sparknode-purple text-white shadow-md shadow-purple-100 ring-1 ring-purple-600'
                        : isCompleted
                        ? 'text-sparknode-purple bg-purple-50/50 hover:bg-purple-100/50'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                    } ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}`}
                  >
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold border-2 transition-all duration-200 mr-4 ${
                        isActive
                          ? 'bg-white text-sparknode-purple border-white rotate-0'
                          : isCompleted
                          ? 'bg-sparknode-purple text-white border-sparknode-purple'
                          : 'bg-transparent border-gray-200 group-hover:border-gray-300'
                      }`}
                    >
                      {isCompleted ? '✓' : s.number}
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-bold ${isActive ? 'text-white' : 'text-gray-700'}`}>
                        {s.name}
                      </p>
                      <p className={`text-[10px] uppercase tracking-wider font-semibold opacity-60 ${isActive ? 'text-purple-100' : 'text-gray-400'}`}>
                        {isActive ? 'Currently editing' : isCompleted ? 'Completed' : 'Waiting'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </nav>
            <div className="p-4 bg-gray-50/30">
              <button
                onClick={() => navigate('/events')}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← EXIT WIZARD
              </button>
            </div>
          </div>

          <div className="mt-6 p-5 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border border-white shadow-sm ring-1 ring-purple-100/50">
            <h4 className="text-xs font-bold text-purple-900 mb-2 italic">Pro Tip</h4>
            <p className="text-[11px] leading-relaxed text-purple-700">
              Fill in the basics first. You can always save as draft and finish the activities later.
            </p>
          </div>
        </aside>

        {/* Main Content Area - Refined Card UI */}
        <main className="flex-1 w-full max-w-4xl">
          {/* Header */}
          <header className="mb-10">
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
              {editingEventId ? 'Edit Event' : 'Create New Event'}
            </h1>
            <div className="flex items-center gap-3 mt-3">
              <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-[10px] font-black uppercase tracking-widest rounded-full">
                Step 0{step}
              </span>
              <div className="h-1.5 w-32 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sparknode-purple transition-all duration-500 ease-out"
                  style={{ width: `${(step / 4) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-gray-400">
                {Math.round((step / 4) * 100)}% Complete
              </span>
            </div>
          </header>

          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden ring-1 ring-gray-200/50">
            {/* Step Content */}
            <div className="p-10 space-y-10 min-h-[500px]">
              {step === 1 && (
                <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="border-b border-gray-100 pb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Event Details</h2>
                    <p className="text-gray-500 mt-1">Provide the foundational information for your event.</p>
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
            </section>
          )}

          {step === 2 && (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b border-gray-100 pb-6">
                <h2 className="text-2xl font-bold text-gray-900">Event Activities</h2>
                <p className="text-gray-500 mt-1">Add activities and sessions to your event.</p>
              </div>

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
                    <select
                      value={newActivity.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          setNewActivity({ ...newActivity, name: '' });
                        } else {
                          setNewActivity({ ...newActivity, name: val });
                        }
                      }}
                      className="input w-full mb-2"
                    >
                      <option value="">Select an activity...</option>
                      <optgroup label="Stage Performances">
                        <option value="Solo Singing">Solo Singing</option>
                        <option value="Group Singing">Group Singing</option>
                        <option value="Solo Dance">Solo Dance</option>
                        <option value="Group Dance">Group Dance</option>
                        <option value="Skit / Drama">Skit / Drama</option>
                        <option value="Stand-up Comedy">Stand-up Comedy</option>
                        <option value="Poetry Recitation">Poetry Recitation</option>
                      </optgroup>
                      <optgroup label="Sports & Outdoors">
                        <option value="Cricket Match">Cricket Match</option>
                        <option value="Badminton">Badminton</option>
                        <option value="Table Tennis">Table Tennis</option>
                        <option value="Marathon / Run">Marathon / Run</option>
                        <option value="Treking / Hiking">Treking / Hiking</option>
                      </optgroup>
                      <optgroup label="Creative & Fun">
                        <option value="Painting / Art">Painting / Art</option>
                        <option value="Photography Contest">Photography Contest</option>
                        <option value="Cooking / Bake-off">Cooking / Bake-off</option>
                        <option value="Quiz / Trivia">Quiz / Trivia</option>
                        <option value="Treasure Hunt">Treasure Hunt</option>
                      </optgroup>
                      <optgroup label="Logistics & Volunteering">
                        <option value="Event Volunteering">Event Volunteering</option>
                        <option value="Gift Pickup">Gift Pickup</option>
                        <option value="Feedback / Survey">Feedback / Survey</option>
                      </optgroup>
                      <option value="custom">-- Custom Activity --</option>
                    </select>
                    
                    {(newActivity.name === 'custom' || !['Solo Singing', 'Group Singing', 'Solo Dance', 'Group Dance', 'Skit / Drama', 'Stand-up Comedy', 'Poetry Recitation', 'Cricket Match', 'Badminton', 'Table Tennis', 'Marathon / Run', 'Treking / Hiking', 'Painting / Art', 'Photography Contest', 'Cooking / Bake-off', 'Quiz / Trivia', 'Treasure Hunt', 'Event Volunteering', 'Gift Pickup', 'Feedback / Survey'].includes(newActivity.name)) && (
                      <input
                        type="text"
                        value={newActivity.name === 'custom' ? '' : newActivity.name}
                        onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                        className="input w-full mt-2"
                        placeholder="Enter custom activity name..."
                      />
                    )}
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

                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={newActivity.requires_approval}
                        onChange={(e) => setNewActivity({ ...newActivity, requires_approval: e.target.checked })}
                        className="mr-2"
                      />
                      Requires Approval
                    </label>
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
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6">
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
            </section>
          )}

          {step === 4 && (
            <section className="space-y-6">
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

              <div className="bg-gray-50/50 p-6 rounded-2xl border border-dashed border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center shrink-0">
                    <HiOutlineSparkles className="w-6 h-6 text-sparknode-purple animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 leading-tight">Wizard Summary</h4>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      You are building <span className="font-extrabold text-blue-600 underline underline-offset-2 italic">{formData.title || 'a new event'}</span> with {activities.length} activities.
                      Budget: <span className="font-bold text-gray-900">{formData.currency} {formData.planned_budget}</span>.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Improved Navigation Buttons Section */}
        <footer className="px-10 py-8 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between gap-4">
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            className="group px-6 py-3 border border-gray-200 bg-white text-gray-600 font-bold rounded-2xl flex items-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-all active:scale-[0.98] shadow-sm"
          >
            <HiOutlineChevronLeft className="w-5 h-5 group-hover:-translate-x-1 duration-200" />
            Previous
          </button>

          <div className="flex items-center gap-4">
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!isStepValid()}
                className="group px-8 py-3 bg-sparknode-purple text-white font-bold rounded-2xl flex items-center gap-3 shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to {steps.find(s => s.number === step + 1)?.name}
                <HiOutlineChevronRight className="w-5 h-5 group-hover:translate-x-1 duration-200" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || !isStepValid()}
                className="group px-10 py-3 bg-black text-white font-bold rounded-2xl flex items-center gap-3 shadow-xl hover:bg-gray-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? 'Finalizing...' : editingEventId ? 'Confirm Updates' : 'Launch Event'}
                <HiOutlineChevronRight className="w-5 h-5 group-hover:translate-x-1 duration-200" />
              </button>
            )}
          </div>
        </footer>
      </div>
    </main>
  </div>
</div>
)
}
