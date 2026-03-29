import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiXMark,
  HiOutlineShoppingBag, HiOutlineSparkles, HiOutlineAdjustmentsHorizontal,
  HiOutlineCheck, HiOutlineCheckCircle, HiMagnifyingGlass,
  HiOutlineGlobeAlt, HiOutlineSquares2X2, HiOutlineArrowPath,
  HiOutlineExclamationTriangle,
} from 'react-icons/hi2'
import { catalogAPI } from '../lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────
const CAT_COLOR = {
  shopping:     'bg-blue-100 text-blue-700',
  food:         'bg-orange-100 text-orange-700',
  experiences:  'bg-purple-100 text-purple-700',
  merchandise:  'bg-green-100 text-green-700',
  travel:       'bg-cyan-100 text-cyan-700',
  entertainment:'bg-pink-100 text-pink-700',
  wellness:     'bg-teal-100 text-teal-700',
  custom:       'bg-violet-100 text-violet-700',
}
const catClass = (c) => CAT_COLOR[c?.toLowerCase()] || 'bg-gray-100 text-gray-700'

// Solid background colors for card banners
const CAT_BG = {
  shopping:      'bg-indigo-500',
  food:          'bg-orange-400',
  experiences:   'bg-purple-500',
  merchandise:   'bg-emerald-500',
  travel:        'bg-sky-500',
  entertainment: 'bg-pink-500',
  wellness:      'bg-teal-500',
  custom:        'bg-violet-500',
}
const catBg = (c) => CAT_BG[c?.toLowerCase()] || 'bg-slate-500'
const toTitle = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, loading }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={loading}
      aria-pressed={checked}
      className={`relative inline-flex items-center w-11 h-6 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 select-none shrink-0 ${
        checked ? 'bg-gradient-to-r from-emerald-400 to-green-500 focus:ring-emerald-400 shadow-emerald-200 shadow-md' : 'bg-gray-200 focus:ring-gray-300'
      } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}

// ── Override Drawer ───────────────────────────────────────────────────────────
function OverrideDrawer({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    custom_min_points: item.custom_min_points ?? '',
    custom_max_points: item.custom_max_points ?? '',
    custom_step_points: item.custom_step_points ?? '',
    visibility_scope: item.visibility_scope || 'all',
    sort_order: item.sort_order ?? 0,
  })
  const qc = useQueryClient()
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const saveMutation = useMutation({
    mutationFn: () => catalogAPI.upsertTenantItem(item.master_item_id, {
      master_item_id: item.master_item_id,
      is_enabled: item.is_enabled,
      custom_min_points: form.custom_min_points !== '' ? Number(form.custom_min_points) : null,
      custom_max_points: form.custom_max_points !== '' ? Number(form.custom_max_points) : null,
      custom_step_points: form.custom_step_points !== '' ? Number(form.custom_step_points) : null,
      visibility_scope: form.visibility_scope,
      sort_order: Number(form.sort_order),
    }),
    onSuccess: () => {
      toast.success('Settings saved')
      qc.invalidateQueries({ queryKey: ['catalog-tenant'] })
      onSaved()
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Save failed'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800">{item.brand} — {item.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Global band: {Number(item.effective_min_points).toLocaleString()} – {Number(item.effective_max_points).toLocaleString()} pts
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <HiXMark className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Override values must stay within the global band. Leave blank to use global defaults.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['custom_min_points', 'Min Points'],
              ['custom_max_points', 'Max Points'],
              ['custom_step_points', 'Step'],
            ].map(([k, label]) => (
              <div key={k}>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
                <input type="number"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form[k]}
                  onChange={e => set(k, e.target.value)}
                  placeholder="(global)"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visibility</label>
              <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                value={form.visibility_scope} onChange={e => set('visibility_scope', e.target.value)}>
                <option value="all">All employees</option>
                <option value="dept">By Department</option>
                <option value="location">By Location</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sort Order</label>
              <input type="number" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                value={form.sort_order} onChange={e => set('sort_order', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Overrides'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Custom Item Form Modal ────────────────────────────────────────────────────
function CustomItemModal({ item, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: item?.name || '',
    category: item?.category || 'custom',
    description: item?.description || '',
    image_url: item?.image_url || '',
    fulfillment_type: item?.fulfillment_type || 'custom',
    points_cost: item?.points_cost ?? '',
    inventory_count: item?.inventory_count ?? '',
    terms_conditions: item?.terms_conditions || '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const saveMutation = useMutation({
    mutationFn: (data) =>
      item ? catalogAPI.updateCustomItem(item.id, data) : catalogAPI.createCustomItem(data),
    onSuccess: () => {
      toast.success(item ? 'Item updated' : 'Custom item created')
      qc.invalidateQueries({ queryKey: ['catalog-custom'] })
      onClose()
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Save failed'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">{item ? 'Edit Custom Item' : 'Add Custom Item'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <HiXMark className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Item Name *</label>
            <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.name} onChange={e => set('name', e.target.value)} placeholder="Company Swag Bag, Extra Day Off…" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</label>
            <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.category} onChange={e => set('category', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fulfillment</label>
            <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              value={form.fulfillment_type} onChange={e => set('fulfillment_type', e.target.value)}>
              <option value="custom">Custom / Internal</option>
              <option value="merchandise">Merchandise</option>
              <option value="experience">Experience</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Points Cost *</label>
            <input type="number" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.points_cost} onChange={e => set('points_cost', e.target.value)} placeholder="500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Inventory</label>
            <input type="number" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.inventory_count} onChange={e => set('inventory_count', e.target.value)} placeholder="(unlimited)" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Image URL</label>
            <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://…" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
            <textarea rows={2} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Terms & Conditions</label>
            <textarea rows={2} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              value={form.terms_conditions} onChange={e => set('terms_conditions', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => saveMutation.mutate({ ...form, points_cost: Number(form.points_cost), inventory_count: form.inventory_count !== '' ? Number(form.inventory_count) : null })}
            disabled={saveMutation.isPending || !form.name || !form.points_cost}
            className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Global Catalog Tab ────────────────────────────────────────────────────────
function GlobalCatalogTab() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  // drafts: { [master_item_id]: { points: string } }
  const [drafts, setDrafts] = useState({})
  const [publishing, setPublishing] = useState(false)

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['catalog-tenant', search, catFilter],
    queryFn: async () => {
      const params = {}
      if (search) params.search = search
      if (catFilter) params.category = catFilter
      return (await catalogAPI.getTenantItems(params)).data
    },
    staleTime: 30000,
  })

  const { data: cats = [] } = useQuery({
    queryKey: ['catalog-tenant-cats'],
    queryFn: async () => (await catalogAPI.getTenantCategories()).data,
  })

  const toggleMutation = useMutation({
    mutationFn: (masterItemId) => catalogAPI.toggleTenantItem(masterItemId),
    onSuccess: () => {
      toast.success('Visibility updated')
      qc.invalidateQueries({ queryKey: ['catalog-tenant'] })
    },
    onError: () => toast.error('Toggle failed'),
  })

  const resetMutation = useMutation({
    mutationFn: (item) => catalogAPI.upsertTenantItem(item.master_item_id, {
      master_item_id: item.master_item_id,
      is_enabled: item.is_enabled,
      custom_min_points: null,
      custom_max_points: null,
      custom_step_points: null,
      visibility_scope: 'all',
      sort_order: 0,
    }),
    onSuccess: (_, item) => {
      toast.success('Reset to global default')
      setDrafts(prev => { const n = { ...prev }; delete n[item.master_item_id]; return n })
      qc.invalidateQueries({ queryKey: ['catalog-tenant'] })
    },
    onError: () => toast.error('Reset failed'),
  })

  // Set or clear a draft value for one card
  const setDraftPoints = (id, value) =>
    setDrafts(prev => ({ ...prev, [id]: { points: value } }))

  // A card is dirty if its draft value is set and differs from the current saved value
  const isDirty = (item) => {
    const d = drafts[item.master_item_id]
    if (!d || d.points === '') return false
    const saved = item.custom_min_points != null ? item.custom_min_points : item.effective_min_points
    return Math.round(Number(d.points)) !== Math.floor(Number(saved))
  }

  // Persist one card's draft to the backend
  const publishItem = async (item) => {
    const d = drafts[item.master_item_id]
    if (!d || d.points === '') return
    const pts = Math.round(Number(d.points))
    // Client-side guard: reject values outside the master band
    if (pts < Number(item.effective_min_points)) {
      toast.error(`Value must be at least ${Math.floor(Number(item.effective_min_points))} pts`)
      return
    }
    if (pts > Number(item.effective_max_points)) {
      toast.error(`Value cannot exceed ${Math.floor(Number(item.effective_max_points))} pts`)
      return
    }
    await catalogAPI.upsertTenantItem(item.master_item_id, {
      master_item_id: item.master_item_id,
      is_enabled: item.is_enabled,
      custom_min_points: pts,
      custom_max_points: pts,
      custom_step_points: null,
      visibility_scope: item.visibility_scope || 'all',
      sort_order: item.sort_order ?? 0,
    })
    setDrafts(prev => { const n = { ...prev }; delete n[item.master_item_id]; return n })
  }

  const dirtyItems = items.filter(isDirty)

  const publishAll = async () => {
    setPublishing(true)
    let successCount = 0
    const errors = []
    await Promise.allSettled(dirtyItems.map(async (item) => {
      try {
        await publishItem(item)
        successCount++
      } catch (e) {
        const msg = e?.response?.data?.detail || e?.message || 'Unknown error'
        errors.push(`${item.brand}: ${msg}`)
      }
    }))
    if (successCount > 0) {
      toast.success(`Published ${successCount} change${successCount !== 1 ? 's' : ''}`)
      qc.invalidateQueries({ queryKey: ['catalog-tenant'] })
    }
    if (errors.length > 0) {
      errors.forEach(msg => toast.error(msg))
    }
    setPublishing(false)
  }

  const enabledCount = items.filter(i => i.is_enabled).length
  const customCount  = items.filter(i => i.custom_min_points != null).length

  return (
    <div>
      {/* Stats — vibrant gradient cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          {
            label: 'Total Rewards',
            value: items.length,
            icon: '🎁',
            grad: 'from-indigo-500 via-purple-500 to-blue-600',
            sub: 'In your catalog',
          },
          {
            label: 'Enabled for Employees',
            value: enabledCount,
            icon: '✅',
            grad: 'from-emerald-400 via-teal-500 to-green-600',
            sub: 'Visible to staff',
          },
          {
            label: 'Hidden',
            value: items.length - enabledCount,
            icon: '🙈',
            grad: 'from-slate-500 via-gray-500 to-zinc-600',
            sub: 'Not visible to staff',
          },
          {
            label: 'Custom Points Set',
            value: customCount,
            icon: '⚙️',
            grad: 'from-amber-400 via-orange-500 to-rose-500',
            sub: 'Tenant overrides',
          },
        ].map(s => (
          <div
            key={s.label}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${s.grad} p-5 shadow-lg`}
          >
            {/* Background decoration */}
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -right-1 -bottom-6 w-16 h-16 rounded-full bg-white/10" />

            {/* Icon */}
            <div className="relative flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shadow-inner">
                {s.icon}
              </div>
            </div>

            {/* Value */}
            <div className="relative">
              <p className="text-4xl font-black text-white leading-none tracking-tight">
                {Math.floor(s.value).toLocaleString()}
              </p>
              <p className="text-sm font-bold text-white/90 mt-1.5">{s.label}</p>
              <p className="text-xs text-white/60 mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-blue-100 px-4 py-3 mb-4 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <HiMagnifyingGlass className="w-4 h-4 text-gray-400 shrink-0" />
          <input className="w-full text-sm outline-none placeholder-gray-400"
            placeholder="Search rewards…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')}>
              <HiXMark className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        <div className="h-5 w-px bg-gray-200" />
        <div className="flex gap-2 shrink-0 flex-wrap">
          <button onClick={() => setCatFilter('')}
            className={`px-3 py-1 text-xs rounded-full font-medium ${!catFilter ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
            All
          </button>
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c === catFilter ? '' : c)}
              className={`px-3 py-1 text-xs rounded-full font-medium ${catFilter === c ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
              {toTitle(c)}
            </button>
          ))}
        </div>
      </div>

      {/* Pending-changes banner */}
      {dirtyItems.length > 0 && (
        <div className="sticky top-4 z-30 mb-5 flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 shadow-lg">
          <div className="flex items-center gap-2">
            <HiOutlineExclamationTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-sm font-semibold text-amber-800">
              {dirtyItems.length} unsaved {dirtyItems.length === 1 ? 'change' : 'changes'}
            </span>
            <span className="text-xs text-amber-600 hidden sm:inline">— cards with orange borders have pending updates</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrafts({})}
              className="text-xs text-amber-700 hover:text-amber-900 font-medium underline underline-offset-2"
            >
              Discard all
            </button>
            <button
              onClick={publishAll}
              disabled={publishing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            >
              <HiOutlineCheckCircle className="w-4 h-4" />
              {publishing ? 'Publishing…' : `Publish ${dirtyItems.length} ${dirtyItems.length === 1 ? 'Change' : 'Changes'}`}
            </button>
          </div>
        </div>
      )}

      {/* Card grid */}
      {isLoading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading rewards…</div>
      ) : isError ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-red-100">
          <HiOutlineExclamationTriangle className="w-10 h-10 text-red-300 mx-auto mb-3" />
          <p className="text-red-500 text-sm font-medium">Failed to load catalog</p>
          <p className="text-gray-400 text-xs mt-1">Check your connection or refresh the page.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-blue-200">
          <HiOutlineShoppingBag className="w-10 h-10 text-blue-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">
            {search || catFilter ? 'No rewards match your filter.' : 'No rewards in the catalog yet.'}
          </p>
          {(search || catFilter) && (
            <button
              onClick={() => { setSearch(''); setCatFilter('') }}
              className="mt-3 text-xs text-blue-500 hover:text-blue-700 underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map(item => {
            const dirty   = isDirty(item)
            const hasCustom = item.custom_min_points != null
            const savedPts  = hasCustom ? item.custom_min_points : item.effective_min_points
            const savedInt  = Math.floor(Number(savedPts))
            const inputVal  = drafts[item.master_item_id]?.points ?? String(savedInt)
            const bg = catBg(item.category)

            return (
              <div
                key={item.master_item_id}
                className={`relative flex flex-col bg-white rounded-2xl shadow-sm overflow-hidden transition-all duration-200 group ${
                  dirty
                    ? 'ring-2 ring-amber-400 shadow-amber-100 shadow-lg'
                    : 'border border-gray-100 hover:shadow-xl hover:-translate-y-1'
                } ${!item.is_enabled ? 'opacity-60 grayscale-[30%]' : ''}`}
              >
                {/* Solid colour banner */}
                <div className={`relative h-20 ${bg} flex items-center justify-between px-4`}>
                  {/* Brand initial */}
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-black text-lg shadow-inner">
                    {item.brand?.[0]?.toUpperCase() || '?'}
                  </div>
                  {/* Toggle top-right */}
                  <div className="shrink-0">
                    <Toggle
                      checked={item.is_enabled}
                      onChange={() => toggleMutation.mutate(item.master_item_id)}
                      loading={toggleMutation.isPending}
                    />
                  </div>
                  {/* Unsaved badge */}
                  {dirty && (
                    <span className="absolute top-2 left-14 px-1.5 py-0.5 bg-amber-400 text-white text-[9px] font-bold rounded-md shadow">
                      Unsaved
                    </span>
                  )}
                  {/* Category pill overlay bottom-right */}
                  <span className={`absolute bottom-2 right-3 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/25 text-white backdrop-blur-sm`}>
                    {toTitle(item.category)}
                  </span>
                </div>

                {/* Card body */}
                <div className="flex flex-col flex-1 px-4 pt-3 pb-4 gap-3">

                  {/* Name */}
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 leading-tight line-clamp-1">{item.brand}</h3>
                    <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">{item.name}</p>
                  </div>

                  {/* Points section */}
                  <div className={`rounded-xl px-3 py-2.5 ${
                    dirty || hasCustom
                      ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'
                      : 'bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        dirty || hasCustom ? 'text-amber-500' : 'text-indigo-400'
                      }`}>Points Required</span>
                      {hasCustom && !dirty && (
                        <button
                          onClick={() => resetMutation.mutate(item)}
                          disabled={resetMutation.isPending}
                          className="p-0.5 text-gray-300 hover:text-red-400 disabled:opacity-40 transition-colors"
                          title="Reset to global default"
                        >
                          <HiOutlineArrowPath className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-2 transition-colors border-0 bg-white/70 ${
                          dirty || hasCustom
                            ? 'text-amber-700 focus:ring-amber-300'
                            : 'text-indigo-700 focus:ring-indigo-300'
                        }`}
                        value={inputVal}
                        onChange={e => setDraftPoints(item.master_item_id, String(Math.round(Number(e.target.value)) || e.target.value))}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && dirty) {
                            publishItem(item)
                              .then(() => { toast.success('Published!'); qc.invalidateQueries({ queryKey: ['catalog-tenant'] }) })
                              .catch(err => toast.error(err?.response?.data?.detail || err?.message || 'Publish failed'))
                          }
                        }}
                      />
                      {dirty && (
                        <button
                          onClick={() =>
                            publishItem(item)
                              .then(() => { toast.success('Published!'); qc.invalidateQueries({ queryKey: ['catalog-tenant'] }) })
                              .catch(err => toast.error(err?.response?.data?.detail || err?.message || 'Publish failed'))
                          }
                          className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                        >
                          <HiOutlineCheck className="w-3.5 h-3.5" />
                          Save
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs mt-auto">
                    <span className="flex items-center gap-1">
                      {hasCustom && !dirty ? (
                        <>
                          <HiOutlineAdjustmentsHorizontal className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-medium text-amber-600">Custom Override</span>
                        </>
                      ) : (
                        <>
                          <HiOutlineGlobeAlt className="w-3.5 h-3.5 text-gray-300" />
                          <span className="text-gray-400">Global Default</span>
                        </>
                      )}
                    </span>
                    <span className={`flex items-center gap-1 font-semibold ${
                      item.is_enabled ? 'text-emerald-600' : 'text-gray-300'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        item.is_enabled ? 'bg-emerald-400 shadow-sm shadow-emerald-300' : 'bg-gray-300'
                      }`} />
                      {item.is_enabled ? 'Visible' : 'Hidden'}
                    </span>
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Custom Items Tab ──────────────────────────────────────────────────────────
function CustomItemsTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['catalog-custom'],
    queryFn: async () => (await catalogAPI.getCustomItems()).data,
    staleTime: 30000,
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (item) => catalogAPI.updateCustomItem(item.id, { is_active: !item.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-custom'] })
      toast.success('Status updated')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => catalogAPI.deleteCustomItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-custom'] })
      toast.success('Deleted')
    },
    onError: () => toast.error('Delete failed'),
  })

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">
          Items unique to your company — swag, internal perks, extra leave days, etc.
        </p>
        <button
          onClick={() => { setEditItem(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 shadow-sm"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Add Custom Item
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-blue-200">
          <HiOutlineSparkles className="w-10 h-10 text-blue-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No custom items yet</p>
          <p className="text-gray-300 text-xs mt-1">Add company-specific perks your employees can redeem</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div key={item.id} className={`group relative bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 ${!item.is_active ? 'opacity-50' : ''}`}>
              {/* Gradient banner / image */}
              <div className="h-32 bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center relative overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <HiOutlineSparkles className="w-12 h-12 text-white/40" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/20 text-white backdrop-blur-sm capitalize`}>
                  {item.category}
                </span>
              </div>
              {/* Info */}
              <div className="px-4 py-3">
                <div className="font-bold text-gray-900 text-sm">{item.name}</div>
                {item.description && (
                  <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 text-violet-700 font-bold text-sm">
                    {Number(item.points_cost).toLocaleString()} <span className="font-normal text-xs">pts</span>
                  </span>
                  {item.inventory_count !== null ? (
                    <span className="text-xs font-medium text-gray-400">{item.inventory_count} left</span>
                  ) : (
                    <span className="text-xs text-gray-300">Unlimited</span>
                  )}
                </div>
              </div>
              {/* Actions */}
              <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between bg-gray-50/50">
                <Toggle
                  checked={item.is_active}
                  onChange={() => toggleActiveMutation.mutate(item)}
                  loading={toggleActiveMutation.isPending}
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditItem(item); setShowModal(true) }}
                    className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                  >
                    <HiOutlinePencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${item.name}"?`)) deleteMutation.mutate(item.id)
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CustomItemModal item={editItem} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TenantCatalog() {
  const [tab, setTab] = useState('global')

  const tabs = [
    { id: 'global', label: 'Global Catalog', icon: HiOutlineGlobeAlt, desc: 'Toggle & configure platform-wide rewards' },
    { id: 'custom', label: 'Custom Items', icon: HiOutlineSquares2X2, desc: 'Company-specific perks & swag' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <HiOutlineShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Company Rewards Catalog</h1>
            <p className="text-sm text-gray-400">Control which rewards are visible to your employees and add your own custom perks.</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-200'
                  : 'bg-white text-gray-500 hover:text-gray-800 hover:shadow-sm border border-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'global' && <GlobalCatalogTab />}
      {tab === 'custom' && <CustomItemsTab />}
    </div>
  )
}
