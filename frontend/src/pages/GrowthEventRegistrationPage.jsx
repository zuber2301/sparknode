import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || ''

async function fetchEvent(slug) {
  const res = await fetch(`${API_URL}/api/experience/growth/events/public/${slug}`)
  if (!res.ok) throw new Error('Event not found')
  return res.json()
}

async function submitRegistration(slug, body) {
  const res = await fetch(`${API_URL}/api/experience/growth/events/public/${slug}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Registration failed')
  return data
}

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtTime(iso, tz) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    })
  } catch {
    return null
  }
}

export default function GrowthEventRegistrationPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '' })
  const [extraFields, setExtraFields] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    if (!slug) return
    fetchEvent(slug)
      .then(data => { setEvent(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [slug])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        ...extraFields,
        // Forward UTM parameters if present
        utm_source: searchParams.get('utm_source') || undefined,
        utm_medium: searchParams.get('utm_medium') || undefined,
        utm_campaign: searchParams.get('utm_campaign') || undefined,
      }
      const result = await submitRegistration(slug, payload)
      setSuccess(result)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading event…</p>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Event not found</h1>
          <p className="text-gray-500 text-sm">
            This event may have ended or the link might be incorrect.
          </p>
        </div>
      </div>
    )
  }

  const schema = event.registration_schema || []
  const dateStr = fmtDate(event.event_date)
  const timeStr = fmtTime(event.event_date, event.timezone)

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're registered!</h1>
          <p className="text-gray-600 mb-4">{success.message}</p>
          <div className="bg-indigo-50 rounded-xl p-4 text-left space-y-1">
            <p className="text-sm font-semibold text-indigo-900">{success.event_title}</p>
            {success.event_date && (
              <p className="text-sm text-indigo-700">📅 {fmtDate(success.event_date)}</p>
            )}
            {success.location && (
              <p className="text-sm text-indigo-700">📍 {success.location}</p>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Check your email for a confirmation. We'll see you there!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      {/* Banner */}
      {event.banner_url && (
        <div
          className="w-full h-48 bg-cover bg-center"
          style={{ backgroundImage: `url(${event.banner_url})` }}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Event header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h1>
          {event.description && (
            <p className="text-gray-600 text-sm mb-4 leading-relaxed">{event.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm">
            {dateStr && (
              <div className="flex items-center gap-1.5 text-gray-700">
                <span>📅</span>
                <span>{dateStr}{timeStr ? ` · ${timeStr}` : ''}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-1.5 text-gray-700">
                <span>📍</span>
                <span>{event.location}</span>
              </div>
            )}
            {event.max_registrations && (
              <div className={`flex items-center gap-1.5 ${event.is_full ? 'text-red-600' : 'text-gray-500'}`}>
                <span>👥</span>
                <span>
                  {event.registration_count} / {event.max_registrations} registered
                  {event.is_full && ' · FULL'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Registration form */}
        {event.is_full ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-lg font-semibold text-red-800">This event is full</p>
            <p className="text-sm text-red-600 mt-1">Registration is no longer available.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Register for this event</h2>
            <p className="text-sm text-gray-500 mb-5">Fill in your details below to secure your spot.</p>

            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Core fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    placeholder="jane@company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Company</label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    placeholder="Acme Inc."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              {/* Dynamic extra fields from registration_schema */}
              {schema.filter(f => !['name', 'email', 'company', 'phone'].includes(f.field)).map(fieldDef => (
                <div key={fieldDef.field}>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    {fieldDef.label || fieldDef.field}
                    {fieldDef.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {fieldDef.type === 'select' && fieldDef.options ? (
                    <select
                      required={fieldDef.required}
                      value={extraFields[fieldDef.field] || ''}
                      onChange={e => setExtraFields(f => ({ ...f, [fieldDef.field]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value="">Select…</option>
                      {fieldDef.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required={fieldDef.required}
                      type={fieldDef.type || 'text'}
                      value={extraFields[fieldDef.field] || ''}
                      onChange={e => setExtraFields(f => ({ ...f, [fieldDef.field]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      placeholder={fieldDef.placeholder || ''}
                    />
                  )}
                </div>
              ))}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {submitting ? 'Registering…' : 'Register Now →'}
              </button>

              <p className="text-[11px] text-gray-400 text-center">
                By registering you agree to receive event-related communications.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
