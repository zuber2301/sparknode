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

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, loading }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-violet-600' : 'bg-gray-200'
      } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-4' : 'translate-x-1'
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
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
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
              <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
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
            className="px-5 py-2 text-sm rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-50"
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
            <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.name} onChange={e => set('name', e.target.value)} placeholder="Company Swag Bag, Extra Day Off…" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</label>
            <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.category} onChange={e => set('category', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fulfillment</label>
            <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              value={form.fulfillment_type} onChange={e => set('fulfillment_type', e.target.value)}>
              <option value="custom">Custom / Internal</option>
              <option value="merchandise">Merchandise</option>
              <option value="experience">Experience</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Points Cost *</label>
            <input type="number" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.points_cost} onChange={e => set('points_cost', e.target.value)} placeholder="500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Inventory</label>
            <input type="number" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.inventory_count} onChange={e => set('inventory_count', e.target.value)} placeholder="(unlimited)" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Image URL</label>
            <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://…" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
            <textarea rows={2} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Terms & Conditions</label>
            <textarea rows={2} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              value={form.terms_conditions} onChange={e => set('terms_conditions', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => saveMutation.mutate({ ...form, points_cost: Number(form.points_cost), inventory_count: form.inventory_count !== '' ? Number(form.inventory_count) : null })}
            disabled={saveMutation.isPending || !form.name || !form.points_cost}
            className="px-5 py-2 text-sm rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-50"
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

  const { data: items = [], isLoading } = useQuery({
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
    return Number(d.points) !== Number(saved)
  }

  // Persist one card's draft to the backend
  const publishItem = async (item) => {
    const d = drafts[item.master_item_id]
    if (!d || d.points === '') return
    const pts = Number(d.points)
    await catalogAPI.upsertTenantItem(item.master_item_id, {
      master_item_id: item.master_item_id,
      is_enabled: item.is_enabled,
      custom_min_points: pts,
      custom_max_points: pts,
      custom_step_points: null,
      visibility_scope: 'all',
      sort_order: 0,
    })
    setDrafts(prev => { const n = { ...prev }; delete n[item.master_item_id]; return n })
  }

  const dirtyItems = items.filter(isDirty)

  const publishAll = async () => {
    setPublishing(true)
    try {
      await Promise.all(dirtyItems.map(publishItem))
      toast.success(`Published ${dirtyItems.length} change${dirtyItems.length !== 1 ? 's' : ''}`)
      qc.invalidateQueries({ queryKey: ['catalog-tenant'] })
    } catch {
      toast.error('Some updates failed — please retry')
    } finally {
      setPublishing(false)
    }
  }

  const enabledCount = items.filter(i => i.is_enabled).length
  const customCount  = items.filter(i => i.custom_min_points != null).length

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Rewards',          value: items.length,  color: 'text-gray-800'   },
          { label: 'Enabled for Employees',  value: enabledCount,  color: 'text-green-600'  },
          { label: 'Hidden',                 value: items.length - enabledCount, color: 'text-gray-400' },
          { label: 'Custom Points Set',      value: customCount,   color: 'text-amber-600'  },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 mb-4 flex items-center gap-3">
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
            className={`px-3 py-1 text-xs rounded-full font-medium ${!catFilter ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All
          </button>
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c === catFilter ? '' : c)}
              className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${catFilter === c ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {c}
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
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map(item => {
            const dirty   = isDirty(item)
            const hasCustom = item.custom_min_points != null
            const savedPts  = hasCustom ? item.custom_min_points : item.effective_min_points
            const inputVal  = drafts[item.master_item_id]?.points ?? String(savedPts)

            return (
              <div
                key={item.master_item_id}
                className={`relative flex flex-col bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 ${
                  dirty
                    ? 'border-amber-300 ring-2 ring-amber-100 shadow-amber-100'
                    : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
                } ${!item.is_enabled ? 'opacity-60' : ''}`}
              >
                {/* Unsaved badge */}
                {dirty && (
                  <span className="absolute top-2 left-2 z-10 px-1.5 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-md">
                    Unsaved
                  </span>
                )}

                {/* Brand image / placeholder */}
                <div className="h-28 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.brand}
                      className="h-20 w-full object-contain p-3"
                      onError={e => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <span className="text-4xl font-extrabold text-gray-200 select-none">
                      {item.brand?.charAt(0)}
                    </span>
                  )}
                  <span className={`absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${catClass(item.category)}`}>
                    {item.category}
                  </span>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 px-4 py-3 gap-3">
                  {/* Brand + item name */}
                  <div>
                    <div className="font-semibold text-sm text-gray-800 truncate">{item.brand}</div>
                    <div className="text-xs text-gray-400 truncate">{item.name}</div>
                  </div>

                  {/* Points input */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Points Required
                      </label>
                      {hasCustom && !dirty && (
                        <button
                          onClick={() => resetMutation.mutate(item)}
                          disabled={resetMutation.isPending}
                          className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors"
                          title="Reset to global default"
                        >
                          <HiOutlineArrowPath className="w-3 h-3" />
                          Reset
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="50"
                        className={`w-full border rounded-lg px-3 py-2 text-sm font-mono font-semibold focus:outline-none focus:ring-2 transition-colors ${
                          dirty
                            ? 'border-amber-300 bg-amber-50 text-amber-800 focus:ring-amber-300'
                            : hasCustom
                            ? 'border-amber-200 bg-amber-50 text-amber-700 focus:ring-amber-300'
                            : 'border-gray-200 text-gray-800 focus:ring-violet-400'
                        }`}
                        value={inputVal}
                        onChange={e => setDraftPoints(item.master_item_id, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && dirty) {
                            publishItem(item)
                              .then(() => {
                                toast.success('Published!')
                                qc.invalidateQueries({ queryKey: ['catalog-tenant'] })
                              })
                              .catch(() => toast.error('Publish failed'))
                          }
                        }}
                      />
                      {dirty && (
                        <button
                          onClick={() =>
                            publishItem(item)
                              .then(() => {
                                toast.success('Published!')
                                qc.invalidateQueries({ queryKey: ['catalog-tenant'] })
                              })
                              .catch(() => toast.error('Publish failed'))
                          }
                          className="shrink-0 flex items-center gap-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                          title="Publish this change"
                        >
                          <HiOutlineCheck className="w-3.5 h-3.5" />
                          Publish
                        </button>
                      )}
                    </div>

                    {/* Source label */}
                    <div className="mt-1 h-4">
                      {hasCustom && !dirty && (
                        <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                          <HiOutlineAdjustmentsHorizontal className="w-3 h-3" />
                          Custom override active
                        </span>
                      )}
                      {!hasCustom && !dirty && (
                        <span className="text-xs text-gray-400">Global default</span>
                      )}
                      {dirty && (
                        <span className="text-xs text-amber-600">
                          Was: {Number(savedPts).toLocaleString()} pts — press Enter or Publish to save
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Visibility toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-500">Employee Visible</span>
                    <Toggle
                      checked={item.is_enabled}
                      onChange={() => toggleMutation.mutate(item.master_item_id)}
                      loading={toggleMutation.isPending}
                    />
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
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-xs font-semibold rounded-xl hover:bg-violet-700 shadow-sm"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Add Custom Item
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <HiOutlineSparkles className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No custom items yet</p>
          <p className="text-gray-300 text-xs mt-1">Add company-specific perks your employees can redeem</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div key={item.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-opacity ${!item.is_active ? 'opacity-50' : ''}`}>
              {/* Image / placeholder */}
              <div className="h-28 bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center relative">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <HiOutlineSparkles className="w-10 h-10 text-violet-200" />
                )}
                <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${catClass(item.category)}`}>
                  {item.category}
                </span>
              </div>
              {/* Info */}
              <div className="px-4 py-3">
                <div className="font-semibold text-gray-800 text-sm">{item.name}</div>
                {item.description && (
                  <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-violet-600">
                    {Number(item.points_cost).toLocaleString()} pts
                  </span>
                  {item.inventory_count !== null ? (
                    <span className="text-xs text-gray-400">{item.inventory_count} left</span>
                  ) : (
                    <span className="text-xs text-gray-300">Unlimited</span>
                  )}
                </div>
              </div>
              {/* Actions */}
              <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
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
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <HiOutlineShoppingBag className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Company Rewards Catalog</h1>
        </div>
        <p className="text-sm text-gray-500">
          Control which rewards are visible to your employees and add your own custom perks.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-3 mb-6">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-white border border-violet-200 text-violet-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white hover:shadow-sm border border-transparent'
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
