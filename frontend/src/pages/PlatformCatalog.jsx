import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  HiOutlinePlus, HiOutlinePencil, HiOutlineTrash,
  HiOutlineEye, HiOutlineEyeSlash, HiOutlineGlobeAlt, HiOutlineSparkles,
  HiXMark, HiOutlineCheck, HiMagnifyingGlass,
} from 'react-icons/hi2'
import { catalogAPI } from '../lib/api'

// ── Brand logo with Clearbit fallback ──────────────────────────────────────────
function brandToDomain(brand) {
  // Known overrides for non-obvious domains
  const overrides = {
    'amazon':     'amazon.com',
    'amazon pay': 'amazon.com',
    'apple':      'apple.com',
    'google':     'google.com',
    'google pay': 'google.com',
    'netflix':    'netflix.com',
    'zomato':     'zomato.com',
    'swiggy':     'swiggy.com',
    'starbucks':  'starbucks.com',
    'flipkart':   'flipkart.com',
    'myntra':     'myntra.com',
    'ajio':       'ajio.com',
    'nykaa':      'nykaa.com',
    'uber':       'uber.com',
    'ola':        'olacabs.com',
    'makemytrip': 'makemytrip.com',
    'cleartrip':  'cleartrip.com',
    'bookmyshow': 'bookmyshow.com',
    'paytm':      'paytm.com',
    'phonepe':    'phonepe.com',
    'croma':      'croma.com',
    'reliance':   'reliancedigital.in',
    'bigbasket':  'bigbasket.com',
    'blinkit':    'blinkit.com',
    'zepto':      'zeptonow.com',
    'dominos':    'dominos.co.in',
    'domino\'s':  'dominos.co.in',
    'pizza hut':  'pizzahut.co.in',
    'kfc':        'kfc.co.in',
    'mcdonalds':  'mcdonalds.com',
    'spotify':    'spotify.com',
    'microsoft':  'microsoft.com',
    'samsung':    'samsung.com',
    'boat':       'boat-lifestyle.com',
    'sony':       'sony.com',
    'nike':       'nike.com',
    'adidas':     'adidas.com',
    'puma':       'puma.com',
  }
  const key = (brand || '').toLowerCase().trim()
  if (overrides[key]) return overrides[key]
  // Generic: strip spaces/special chars, append .com
  return key.replace(/[^a-z0-9]/g, '') + '.com'
}

function BrandLogo({ brand, imageUrl, size = 'w-8 h-8' }) {
  const [src, setSrc] = useState(imageUrl || `https://logo.clearbit.com/${brandToDomain(brand)}`)
  const [failed, setFailed] = useState(false)

  const handleError = () => {
    if (!failed && src !== imageUrl) {
      // imageUrl was not the first attempt — already on Clearbit, give up
      setFailed(true)
    } else if (imageUrl && src === imageUrl) {
      // imageUrl failed, try Clearbit
      setSrc(`https://logo.clearbit.com/${brandToDomain(brand)}`)
    } else {
      setFailed(true)
    }
  }

  if (failed) {
    return (
      <div className={`${size} rounded-xl bg-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0`}>
        {(brand || '?').charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={brand}
      onError={handleError}
      className={`${size} rounded-xl object-contain bg-white border border-slate-200 shrink-0`}
    />
  )
}

// ── Category color map ────────────────────────────────────────────────────────
const CAT_COLOR = {
  shopping:     'bg-blue-100 text-blue-700',
  food:         'bg-orange-100 text-orange-700',
  experiences:  'bg-purple-100 text-purple-700',
  merchandise:  'bg-green-100 text-green-700',
  travel:       'bg-cyan-100 text-cyan-700',
  entertainment:'bg-pink-100 text-pink-700',
  wellness:     'bg-teal-100 text-teal-700',
  custom:       'bg-gray-100 text-gray-700',
}
const catClass = (c) => CAT_COLOR[c?.toLowerCase()] || 'bg-gray-100 text-gray-700'

const FULFILLMENT_LABELS = {
  voucher:      '🎫 Voucher',
  merchandise:  '📦 Merchandise',
  experience:   '✨ Experience',
  custom:       '🏷 Custom',
}

// ── Item Form Modal ───────────────────────────────────────────────────────────
function ItemFormModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    brand: item?.brand || '',
    name: item?.name || '',
    category: item?.category || '',
    provider_code: item?.provider_code || '',
    fulfillment_type: item?.fulfillment_type || 'voucher',
    min_points: item?.min_points ?? '',
    max_points: item?.max_points ?? '',
    step_points: item?.step_points ?? 50,
    image_url: item?.image_url || '',
    description: item?.description || '',
    validity_days: item?.validity_days ?? 365,
    is_active_global: item?.is_active_global ?? true,
  })
  const qc = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: (data) =>
      item
        ? catalogAPI.adminUpdateItem(item.id, data)
        : catalogAPI.adminCreateItem(data),
    onSuccess: () => {
      toast.success(item ? 'Item updated' : 'Item created')
      qc.invalidateQueries({ queryKey: ['catalog-admin'] })
      onSaved()
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Save failed'),
  })

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {item ? 'Edit Catalog Item' : 'Add New Catalog Item'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand *</label>
            <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Amazon, Zomato…" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Item Name *</label>
            <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.name} onChange={e => set('name', e.target.value)} placeholder="₹500 Gift Card" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category *</label>
            <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.category} onChange={e => set('category', e.target.value)} placeholder="shopping, food, travel…" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fulfillment Type</label>
            <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              value={form.fulfillment_type} onChange={e => set('fulfillment_type', e.target.value)}>
              <option value="voucher">Voucher</option>
              <option value="merchandise">Merchandise</option>
              <option value="experience">Experience</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Min Points *</label>
            <input type="number" step="1" min="0" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.min_points} onChange={e => set('min_points', Math.floor(Number(e.target.value)) || '')} placeholder="100" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Max Points *</label>
            <input type="number" step="1" min="0" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.max_points} onChange={e => set('max_points', Math.floor(Number(e.target.value)) || '')} placeholder="5000" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step Points <span className="text-gray-400 normal-case font-normal">(multiples of 50)</span></label>
            <input type="number" step="50" min="50" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.step_points} onChange={e => set('step_points', Math.floor(Number(e.target.value) / 50) * 50 || 50)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Validity (days)</label>
            <input type="number" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.validity_days} onChange={e => set('validity_days', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Provider / SKU Code</label>
            <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={form.provider_code} onChange={e => set('provider_code', e.target.value)} placeholder="Xoxoday/GiftPort SKU" />
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
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="active-global" checked={form.is_active_global}
              onChange={e => set('is_active_global', e.target.checked)} className="w-4 h-4 accent-violet-600" />
            <label htmlFor="active-global" className="text-sm text-gray-700">Active globally (visible to all tenants)</label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-5 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => saveMutation.mutate({
              ...form,
              min_points: Number(form.min_points),
              max_points: Number(form.max_points),
              step_points: Number(form.step_points),
              validity_days: Number(form.validity_days),
            })}
            disabled={saveMutation.isPending || !form.brand || !form.name || !form.category || !form.min_points || !form.max_points}
            className="px-6 py-2 text-sm rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PlatformCatalog() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['catalog-admin', search, categoryFilter],
    queryFn: async () => {
      const params = {}
      if (search) params.search = search
      if (categoryFilter) params.category = categoryFilter
      const res = await catalogAPI.adminListItems(params)
      return res.data
    },
    staleTime: 30000,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['catalog-admin-categories'],
    queryFn: async () => (await catalogAPI.adminCategories()).data,
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => catalogAPI.adminToggleItem(id),
    onSuccess: () => {
      toast.success('Status updated')
      qc.invalidateQueries({ queryKey: ['catalog-admin'] })
    },
    onError: () => toast.error('Toggle failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => catalogAPI.adminDeleteItem(id),
    onSuccess: () => {
      toast.success('Item deleted')
      qc.invalidateQueries({ queryKey: ['catalog-admin'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  const active = items.filter(i => i.is_active_global).length
  const inactive = items.length - active

  return (
    <div className="min-h-screen bg-slate-100 p-6">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-6 py-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
            <HiOutlineGlobeAlt className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Global Rewards Catalog</h1>
            <p className="text-sm text-gray-500 mt-0.5">Platform-wide master catalog — tenants configure visibility &amp; point ranges from this library.</p>
          </div>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowModal(true) }}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm transition-colors"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* ── Stats bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Items',     value: items.length, bg: 'bg-blue-600',  text: 'text-white',      sub: 'text-blue-100' },
          { label: 'Active Globally', value: active,       bg: 'bg-emerald-600', text: 'text-white',    sub: 'text-emerald-100' },
          { label: 'Paused',          value: inactive,     bg: 'bg-white',     text: 'text-slate-800',  sub: 'text-slate-400', border: 'border border-slate-200' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border || ''} rounded-2xl px-6 py-5 shadow-sm`}>
            <div className={`text-4xl font-extrabold leading-none ${s.text}`}>{s.value}</div>
            <div className={`text-sm font-medium mt-2 ${s.sub}`}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3.5 mb-5 flex items-center gap-4">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <HiMagnifyingGlass className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            className="w-full text-sm outline-none text-slate-700 placeholder-slate-400 bg-transparent"
            placeholder="Search brand or item name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
              <HiXMark className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="h-6 w-px bg-slate-200 shrink-0" />
        <div className="flex gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${!categoryFilter ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >All</button>
          {categories.map(c => (
            <button key={c}
              onClick={() => setCategoryFilter(c === categoryFilter ? '' : c)}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium capitalize transition-all ${categoryFilter === c ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >{c}</button>
          ))}
        </div>
      </div>

      {/* ── Card Grid ────────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 text-base">Loading catalog…</div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <HiOutlineSparkles className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 text-base font-medium">No catalog items yet.</p>
          <p className="text-slate-300 text-sm mt-1">Click "Add Item" to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map(item => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden ${
                !item.is_active_global ? 'opacity-50' : ''
              }`}
            >
              {/* Brand header */}
              <div className="px-5 pt-5 pb-4 flex items-center gap-3">
                <BrandLogo brand={item.brand} imageUrl={item.image_url} size="w-12 h-12" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-gray-900 truncate text-base leading-snug">{item.brand}</div>
                  <div className="text-sm text-gray-500 truncate mt-0.5 leading-snug">{item.name}</div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-100 mx-0" />

              {/* Body */}
              <div className="px-5 py-4 flex-1 space-y-3">
                {/* Category + type row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${catClass(item.category)}`}>
                    {item.category}
                  </span>
                  <span className="px-2.5 py-1 text-xs font-medium text-slate-500 bg-slate-100 rounded-lg">
                    {FULFILLMENT_LABELS[item.fulfillment_type] || item.fulfillment_type}
                  </span>
                </div>

                {/* Points band — prominent */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                  <div className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-0.5">Points Range</div>
                  <div className="font-bold text-blue-700 text-base font-mono">
                    {Number(item.min_points).toLocaleString()} – {Number(item.max_points).toLocaleString()}
                    <span className="text-blue-400 font-normal text-sm ml-1">pts</span>
                  </div>
                </div>

                {/* SKU */}
                {item.provider_code ? (
                  <div className="text-sm text-slate-400 font-mono truncate" title={item.provider_code}>
                    SKU: {item.provider_code}
                  </div>
                ) : (
                  <div className="text-sm text-slate-300 italic">No provider SKU</div>
                )}
              </div>

              {/* Footer */}
              <div className="h-px bg-slate-100" />
              <div className="px-5 py-3 flex items-center justify-between">
                <button
                  onClick={() => toggleMutation.mutate(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    item.is_active_global
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                  }`}
                >
                  {item.is_active_global
                    ? <HiOutlineEye className="w-4 h-4" />
                    : <HiOutlineEyeSlash className="w-4 h-4" />}
                  {item.is_active_global ? 'Active' : 'Paused'}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditItem(item); setShowModal(true) }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <HiOutlinePencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${item.name}"? This will also remove all tenant overrides.`)) {
                        deleteMutation.mutate(item.id)
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ItemFormModal
          item={editItem}
          onClose={() => setShowModal(false)}
          onSaved={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
