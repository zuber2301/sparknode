import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salesAPI } from '../lib/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

export default function SalesEvents() {
  const { tenantContext } = useAuthStore()
  const qc = useQueryClient()
  
  // Check if sales & marketing feature is enabled
  const salesEnabled = tenantContext?.feature_flags?.sales_marketting_enabled
  if (!salesEnabled) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-yellow-800">Feature Not Available</h3>
          <p className="text-yellow-700">Sales & Marketing module is not enabled for your organization.</p>
        </div>
      </div>
    )
  }
  const { data: eventsResponse, isLoading } = useQuery(['salesEvents'], () => salesAPI.list().then(r => r.data))
  const [showCreate, setShowCreate] = useState(false)
  const createMutation = useMutation((payload) => salesAPI.create(payload).then(r => r.data), {
    onSuccess: () => { qc.invalidateQueries(['salesEvents']); setShowCreate(false); toast.success('Sales event created') },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to create event')
  })

  const handleCreate = (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    createMutation.mutate({
      name: fd.get('name'),
      description: fd.get('description'),
      event_type: fd.get('event_type'),
      start_at: fd.get('start_at'),
      end_at: fd.get('end_at'),
      location: fd.get('location'),
    })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Sales Events</h2>
        <div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>Create Sales Event</button>
        </div>
      </div>

      <div className="bg-white rounded-md shadow p-4">
        {isLoading ? <div>Loading...</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th>Name</th>
                <th>Type</th>
                <th>Start</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(eventsResponse || []).map((ev) => (
                <tr key={ev.id} className="border-t">
                  <td className="py-2">{ev.name}</td>
                  <td>{ev.event_type}</td>
                  <td>{new Date(ev.start_at).toLocaleString()}</td>
                  <td>{ev.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-md w-[720px]">
            <h3 className="font-semibold mb-2">Create Sales Event (Basic)</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="label">Name</label>
                <input name="name" className="input" required />
              </div>
              <div>
                <label className="label">Type</label>
                <select name="event_type" className="input" defaultValue="webinar">
                  <option value="webinar">Webinar</option>
                  <option value="conference">Conference</option>
                  <option value="partner_event">Partner Event</option>
                  <option value="roadshow">Roadshow</option>
                  <option value="booth">Booth</option>
                  <option value="virtual_demo">Virtual Demo Day</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Start At</label>
                  <input name="start_at" type="datetime-local" className="input" required />
                </div>
                <div>
                  <label className="label">End At</label>
                  <input name="end_at" type="datetime-local" className="input" />
                </div>
              </div>
              <div>
                <label className="label">Location / Link</label>
                <input name="location" className="input" />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
