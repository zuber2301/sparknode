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
      <div className={`${size} rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center text-xs font-bold text-violet-600 border border-violet-100 shrink-0`}>
        {(brand || '?').charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={brand}
      onError={handleError}
      className={`${size} rounded-lg object-contain bg-white border border-gray-100 shrink-0`}
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
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <HiOutlineGlobeAlt className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Global Rewards Catalog</h1>
          </div>
          <p className="text-sm text-gray-500">Platform-wide master catalog. Tenants configure visibility & point ranges from this library.</p>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 shadow-sm"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Items', value: items.length, color: 'text-gray-800' },
          { label: 'Active Globally', value: active, color: 'text-green-600' },
          { label: 'Paused', value: inactive, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-sm">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <HiMagnifyingGlass className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            className="w-full text-sm outline-none text-gray-700 placeholder-gray-400"
            placeholder="Search brand or item name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
              <HiXMark className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="h-5 w-px bg-gray-200" />
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${!categoryFilter ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >All</button>
          {categories.map(c => (
            <button key={c}
              onClick={() => setCategoryFilter(c === categoryFilter ? '' : c)}
              className={`px-3 py-1 text-xs rounded-full font-medium capitalize transition-all ${categoryFilter === c ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >{c}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading catalog…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <HiOutlineSparkles className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No catalog items yet. Add the first one!</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand / Item</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Points Band</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Provider SKU</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => (
                <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${!item.is_active_global ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <BrandLogo brand={item.brand} imageUrl={item.image_url} />
                      <div>
                        <div className="font-semibold text-gray-800">{item.brand}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{item.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${catClass(item.category)}`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-gray-600">
                    {FULFILLMENT_LABELS[item.fulfillment_type] || item.fulfillment_type}
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="font-mono text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
                      {Number(item.min_points).toLocaleString()} – {Number(item.max_points).toLocaleString()} pts
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-gray-400 font-mono">
                    {item.provider_code || <span className="italic">—</span>}
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <button
                      onClick={() => toggleMutation.mutate(item.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        item.is_active_global
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                    >
                      {item.is_active_global ? <HiOutlineEye className="w-3 h-3" /> : <HiOutlineEyeSlash className="w-3 h-3" />}
                      {item.is_active_global ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditItem(item); setShowModal(true) }}
                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
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
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
