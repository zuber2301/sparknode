import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { growthEventsAPI } from '../lib/api'
import ProGate from '../components/ProGate'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import {
  HiOutlinePlus,
  HiOutlineCalendar,
  HiOutlineLocationMarker,
  HiOutlineUsers,
  HiOutlineExternalLink,
  HiOutlineTrash,
  HiOutlineX,
} from 'react-icons/hi'

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  closed:    'bg-red-100 text-red-600',
  archived:  'bg-yellow-100 text-yellow-700',
}

const EMPTY_FORM = {
  title: '',
  description: '',
  event_date: '',
  location: '',
  timezone: 'UTC',
  max_registrations: '',
  banner_url: '',
}

export default function GrowthEvents() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const canManage = ['tenant_manager', 'platform_admin', 'hr_admin'].includes(user?.org_role)

  const { data: eventsResp, isLoading } = useQuery({
    queryKey: ['growthEvents'],
    queryFn: () => growthEventsAPI.list().then(r => r.data),
  })

  const { data: regsResp } = useQuery({
    queryKey: ['growthEventRegistrations', selectedEvent?.id],
    queryFn: () => growthEventsAPI.getRegistrations(selectedEvent.id).then(r => r.data),
    enabled: !!selectedEvent?.id,
  })

  const createMutation = useMutation({
    mutationFn: (body) => growthEventsAPI.create(body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['growthEvents'] })
      setShowCreate(false)
      setForm(EMPTY_FORM)
      toast.success('Growth event created')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to create event'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => growthEventsAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['growthEvents'] })
      if (selectedEvent) setSelectedEvent(null)
      toast.success('Event deleted')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to delete event'),
  })

  const events = Array.isArray(eventsResp) ? eventsResp : []
  const registrations = Array.isArray(regsResp) ? regsResp : []

  const handleCreate = (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      max_registrations: form.max_registrations ? Number(form.max_registrations) : undefined,
      event_date: form.event_date || undefined,
    }
    createMutation.mutate(payload)
  }

  const publicLink = (slug) => `${window.location.origin}/e/${slug}`

  return (
    <ProGate feature="IgniteNode">
      <div className="p-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Growth Events</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Lead-capture event pages for campaigns &amp; webinars
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <HiOutlinePlus className="w-4 h-4" />
              New Growth Event
            </button>
          )}
        </div>

        {/* Event list */}
        {isLoading ? (
          <div className="text-gray-400 text-sm">Loading…</div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">No growth events yet.</p>
            {canManage && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                <HiOutlinePlus className="w-4 h-4" />
                Create your first event
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                {ev.banner_url && (
                  <img
                    src={ev.banner_url}
                    alt=""
                    className="w-full h-32 object-cover rounded-t-xl"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{ev.title}</h3>
                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ev.status] || STATUS_COLORS.draft}`}>
                      {ev.status}
                    </span>
                  </div>

                  {ev.event_date && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                      <HiOutlineCalendar className="w-3.5 h-3.5" />
                      {new Date(ev.event_date).toLocaleDateString()}
                    </p>
                  )}
                  {ev.location && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                      <HiOutlineLocationMarker className="w-3.5 h-3.5" />
                      {ev.location}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <HiOutlineUsers className="w-3.5 h-3.5" />
                    {ev.registration_count ?? 0}
                    {ev.max_registrations ? ` / ${ev.max_registrations}` : ''} registrations
                  </p>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => setSelectedEvent(selectedEvent?.id === ev.id ? null : ev)}
                      className="text-xs text-orange-600 hover:underline"
                    >
                      {selectedEvent?.id === ev.id ? 'Hide leads ▲' : 'View leads ▼'}
                    </button>
                    <a
                      href={publicLink(ev.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto text-gray-400 hover:text-gray-600"
                      title="Public registration page"
                    >
                      <HiOutlineExternalLink className="w-4 h-4" />
                    </a>
                    {canManage && (
                      <button
                        onClick={() => deleteMutation.mutate(ev.id)}
                        className="text-gray-400 hover:text-red-500"
                        title="Delete event"
                      >
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Registrations panel */}
                {selectedEvent?.id === ev.id && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    <p className="text-xs font-semibold text-gray-600 mt-3 mb-2">Leads / Registrations</p>
                    {registrations.length === 0 ? (
                      <p className="text-xs text-gray-400">No registrations yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {registrations.slice(0, 20).map((r) => (
                          <li key={r.id} className="text-xs text-gray-700 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                            {r.data?.name || r.data?.email || r.id}
                            {r.data?.email && r.data?.name && (
                              <span className="text-gray-400">— {r.data.email}</span>
                            )}
                          </li>
                        ))}
                        {registrations.length > 20 && (
                          <li className="text-xs text-gray-400">+ {registrations.length - 20} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">New Growth Event</h2>
                <button onClick={() => setShowCreate(false)}>
                  <HiOutlineX className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                  <input
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Q3 Lead Gen Webinar"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Short description shown on the registration page"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Date</label>
                    <input
                      type="datetime-local"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      value={form.event_date}
                      onChange={e => setForm({ ...form, event_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Registrations</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      value={form.max_registrations}
                      onChange={e => setForm({ ...form, max_registrations: e.target.value })}
                      placeholder="Unlimited"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    value={form.location}
                    onChange={e => setForm({ ...form, location: e.target.value })}
                    placeholder="Virtual / City, Country"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image URL</label>
                  <input
                    type="url"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    value={form.banner_url}
                    onChange={e => setForm({ ...form, banner_url: e.target.value })}
                    placeholder="https://…"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-5 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {createMutation.isPending ? 'Creating…' : 'Create Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProGate>
  )
}
