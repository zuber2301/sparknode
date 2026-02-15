import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { salesAPI } from '../lib/api'
import toast from 'react-hot-toast'

export default function SalesEventRegistration() {
  const { eventId } = useParams()
  const { data: eventResp } = useQuery(['salesEvent', eventId], () => salesAPI.get(eventId).then(r => r.data))
  const mutation = useMutation((payload) => salesAPI.publicRegister(eventId, payload).then(r => r.data), {
    onSuccess: () => toast.success('Registered successfully'),
    onError: (err) => toast.error(err.response?.data?.detail || 'Registration failed')
  })
  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    mutation.mutate({
      full_name: fd.get('full_name'),
      email: fd.get('email'),
      company: fd.get('company'),
      role: fd.get('role')
    })
  }

  const event = eventResp

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">{event?.name || 'Sales Event'}</h2>
      <p className="text-sm text-gray-600 mb-4">{event?.description}</p>

      <div className="bg-white p-4 rounded-md shadow">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Full name</label>
            <input name="full_name" className="input" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" required />
          </div>
          <div>
            <label className="label">Company</label>
            <input name="company" className="input" />
          </div>
          <div>
            <label className="label">Role</label>
            <input name="role" className="input" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="submit" className="btn-primary">Register</button>
          </div>
        </form>
      </div>
    </div>
  )
}
