import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { engagementAPI } from '../lib/api'
import { HiOutlinePlusSm, HiOutlinePencil, HiOutlineTrash, HiSparkles } from 'react-icons/hi'
import toast from 'react-hot-toast'

const BLANK = { name: '', emoji: '⭐', description: '', sort_order: 0 }

export default function CompanyValues() {
  const [editing, setEditing] = useState(null) // null = closed, {} = new, {id,...} = existing
  const [form, setForm] = useState(BLANK)
  const queryClient = useQueryClient()

  const { data: values, isLoading } = useQuery({
    queryKey: ['engagement', 'values'],
    queryFn: () => engagementAPI.getValues().then(r => r.data),
    staleTime: 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data) => engagementAPI.createValue(data),
    onSuccess: () => { queryClient.invalidateQueries(['engagement', 'values']); toast.success('Value added!'); setEditing(null) },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => engagementAPI.updateValue(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['engagement', 'values']); toast.success('Updated!'); setEditing(null) },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => engagementAPI.deleteValue(id),
    onSuccess: () => { queryClient.invalidateQueries(['engagement', 'values']); toast.success('Removed') },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed'),
  })

  const openCreate = () => { setForm(BLANK); setEditing('new') }
  const openEdit = (v) => { setForm({ name: v.name, emoji: v.emoji || '⭐', description: v.description || '', sort_order: v.sort_order || 0 }); setEditing(v.id) }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    if (editing === 'new') createMutation.mutate(form)
    else updateMutation.mutate({ id: editing, ...form })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <HiSparkles className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Company Values</h1>
            <p className="text-sm text-gray-500">Values employees can tag when recognizing peers</p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <HiOutlinePlusSm className="w-5 h-5" /> Add Value
        </button>
      </div>

      {/* Create / Edit form */}
      {editing !== null && (
        <form onSubmit={handleSubmit} className="card border-2 border-emerald-200 space-y-4">
          <h3 className="font-semibold text-gray-900">{editing === 'new' ? 'New Company Value' : 'Edit Value'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input className="input w-full" placeholder="e.g. Customer First" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
              <input className="input w-full" placeholder="⭐" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} maxLength={4} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input className="input w-full" placeholder="Brief description..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input type="number" className="input w-full" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary">
              {editing === 'new' ? 'Add Value' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {/* Values list */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card animate-pulse h-16" />)}</div>
      ) : values?.length > 0 ? (
        <div className="space-y-2">
          {values.map(v => (
            <div key={v.id} className="card flex items-center gap-4">
              <span className="text-2xl flex-shrink-0">{v.emoji || '⭐'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{v.name}</p>
                {v.description && <p className="text-sm text-gray-500 truncate">{v.description}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(v)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                  <HiOutlinePencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { if (window.confirm(`Remove "${v.name}"?`)) deleteMutation.mutate(v.id) }}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <HiSparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No company values yet</h3>
          <p className="text-sm text-gray-500 mb-4">Add values that employees can tag when recognizing peers.</p>
          <button onClick={openCreate} className="btn-primary">Add First Value</button>
        </div>
      )}
    </div>
  )
}
