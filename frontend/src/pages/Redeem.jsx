import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogAPI, walletsAPI, redemptionAPI, recognitionAPI } from '../lib/api'
import toast from 'react-hot-toast'
import { HiOutlineGift, HiOutlineSearch, HiOutlineSparkles, HiOutlineStar, HiOutlineX } from 'react-icons/hi'
import RewardsCatalog from '../components/RewardsCatalog'
import RedemptionHistory from '../components/RedemptionHistory'
import RedemptionFlow from '../components/RedemptionFlow'
import { useAuthStore } from '../store/authStore'
import { formatPoints } from '../lib/currency'

/** Normalise a catalog browse item into the shape RewardsCatalog + RedemptionFlow expect */
function normaliseCatalogItem(item) {
  return {
    ...item,
    brand_name: item.brand,
    brand_logo: item.image_url || null,
    points_required: item.min_points,
    denomination: item.min_points,
    id: item.source_voucher_id || item.id,
    catalog_item_id: item.id,
    catalog_source: item.source,
  }
}

// Deterministic card background palette for brand cards
const CARD_PALETTES = [
  { bg: '#1a1a2e', text: '#ffffff' },
  { bg: '#cb202d', text: '#ffffff' },
  { bg: '#006491', text: '#ffffff' },
  { bg: '#2b2d42', text: '#ffffff' },
  { bg: '#00695c', text: '#ffffff' },
  { bg: '#4a148c', text: '#ffffff' },
  { bg: '#bf360c', text: '#ffffff' },
  { bg: '#1b5e20', text: '#ffffff' },
]

function getBrandPalette(brandName = '') {
  const idx = brandName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % CARD_PALETTES.length
  return CARD_PALETTES[idx]
}

/** Individual gift card for the tenant_user redeem view */
function GiftCard({ voucher, balance, onRedeem, displayCurrency }) {
  const canAfford = parseFloat(balance) >= parseFloat(voucher.points_required)
  const palette = getBrandPalette(voucher.brand_name)
  const isEmoji = voucher.brand_logo && !voucher.brand_logo.startsWith('/')
  const isUrl = voucher.brand_logo && !isEmoji

  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1 bg-white ${!canAfford ? 'opacity-55' : ''}`}
    >
      {/* Brand image panel */}
      <div
        className="h-36 flex items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: palette.bg }}
      >
        {canAfford && (
          <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-green-400 shadow-md shadow-green-400/50" />
        )}
        {isUrl ? (
          <img
            src={voucher.brand_logo}
            alt={voucher.brand_name}
            className="h-14 object-contain drop-shadow-lg"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : isEmoji ? (
          <span className="text-6xl">{voucher.brand_logo}</span>
        ) : (
          <span className="text-6xl font-black opacity-30" style={{ color: palette.text }}>
            {voucher.brand_name?.[0] || '?'}
          </span>
        )}
      </div>

      {/* Card footer */}
      <div className="p-4">
        <p className="font-bold text-gray-900 leading-tight">{voucher.brand_name}</p>
        <p className="text-xs text-gray-400 mb-3">Gift Cards</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-sparknode-purple whitespace-nowrap">
            {Number(voucher.points_required).toLocaleString()} pts
          </span>
          <button
            onClick={() => onRedeem(voucher)}
            disabled={!canAfford}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
              canAfford
                ? 'border-sparknode-purple text-sparknode-purple hover:bg-sparknode-purple hover:text-white'
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {canAfford ? 'Redeem Card' : 'Not enough pts'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Two-panel redeem experience for tenant_user role */
function TenantUserRedeemView({
  wallet, catalogItems, categories, redemptions,
  loadingVouchers, onRedeem, displayCurrency, tenantContext,
}) {
  const [activeTab, setActiveTab] = useState('catalog')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const { user } = useAuthStore()

  const { data: stats } = useQuery({
    queryKey: ['myRecognitionStats'],
    queryFn: () => recognitionAPI.getMyStats(),
  })

  const balance = wallet?.data?.balance || 0
  const fxRate = parseFloat(tenantContext?.fx_rate) || 1

  // --- user display helpers ---
  const formatLocalPart = (local = '') =>
    local.split(/[_.\-]+/).filter(Boolean)
      .map(w => w[0].toUpperCase() + w.slice(1)).join(' ')

  const getDisplayName = () => {
    if (user?.first_name && user?.last_name) return `${user.first_name} ${user.last_name}`
    if (user?.first_name) return user.first_name
    return formatLocalPart(user?.email?.split('@')[0]) || 'User'
  }

  const getInitials = () => {
    const a = user?.first_name?.[0] || ''
    const b = user?.last_name?.[0] || ''
    if (a || b) return (a + b).toUpperCase()
    const name = getDisplayName()
    const parts = name.split(' ')
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U'
  }

  const topBadge = stats?.data?.top_badges?.[0]
  const totalReceived = stats?.data?.total_received || 0
  const totalGiven = stats?.data?.total_given || 0

  // --- filter vouchers ---
  const filtered = (catalogItems || []).filter(v => {
    const q = searchQuery.toLowerCase()
    const matchQ = !q || v.name.toLowerCase().includes(q) || v.brand_name.toLowerCase().includes(q)
    const matchCat = !selectedCategory || v.category === selectedCategory
    return matchQ && matchCat
  })

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ───── Left: Profile Sidebar ───── */}
      <aside className="lg:w-64 xl:w-72 flex-shrink-0">
        <div className="bg-gradient-to-b from-sparknode-purple to-indigo-700 rounded-2xl p-6 text-white sticky top-6 shadow-lg">
          {/* Avatar */}
          <div className="w-20 h-20 mx-auto rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl font-bold mb-4">
            {getInitials()}
          </div>

          {/* Name */}
          <h2 className="text-center text-lg font-bold leading-tight">{getDisplayName()}</h2>

          {/* Achievement badge */}
          {topBadge ? (
            <div className="mt-3 flex justify-center">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                <HiOutlineStar className="w-3.5 h-3.5 text-yellow-300" />
                {topBadge.name}
              </span>
            </div>
          ) : (
            <div className="mt-3 flex justify-center">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 text-white/70 text-xs">
                <HiOutlineSparkles className="w-3.5 h-3.5" />
                Start earning badges
              </span>
            </div>
          )}

          {/* Points balance */}
          <div className="mt-6 text-center">
            <p className="text-white/60 text-xs uppercase tracking-widest">Points Balance</p>
            <p className="text-4xl font-extrabold mt-1">{formatPoints(balance, displayCurrency)}</p>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{totalReceived}</p>
              <p className="text-xs text-white/60 mt-0.5">Recognised</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{totalGiven}</p>
              <p className="text-xs text-white/60 mt-0.5">Kudos Given</p>
            </div>
          </div>

          {/* Lifetime hint */}
          <p className="mt-4 text-center text-xs text-white/40">
            Lifetime earned · {formatPoints(wallet?.data?.lifetime_earned || 0, displayCurrency)}
          </p>
        </div>
      </aside>

      {/* ───── Right: Catalog Panel ───── */}
      <div className="flex-1 min-w-0">
        {/* Panel header + tabs */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Redeem Points</h1>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'catalog' ? 'bg-white text-sparknode-purple shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Catalog
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'history' ? 'bg-white text-sparknode-purple shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              My Redemptions
            </button>
          </div>
        </div>

        {activeTab === 'catalog' ? (
          <>
            {/* Search + category filter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search brands or rewards…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sparknode-purple/30 focus:border-sparknode-purple"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <HiOutlineX className="w-4 h-4" />
                  </button>
                )}
              </div>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="sm:w-44 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sparknode-purple/30 focus:border-sparknode-purple bg-white"
              >
                <option value="">All Categories</option>
                {(categories?.data || []).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Gift card grid */}
            {loadingVouchers ? (
              <div className="text-center py-16">
                <div className="inline-block w-8 h-8 border-4 border-sparknode-purple border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-400 text-sm">Loading rewards…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <HiOutlineGift className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No rewards found</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your search or category filter</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map(v => (
                  <GiftCard
                    key={v.id}
                    voucher={v}
                    balance={balance}
                    onRedeem={onRedeem}
                    displayCurrency={displayCurrency}
                    fxRate={fxRate}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <RedemptionHistory
            redemptions={redemptions?.data || []}
            displayCurrency={displayCurrency}
          />
        )}
      </div>
    </div>
  )
}

export default function Redeem() {
  const [activeTab, setActiveTab] = useState('catalog')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVoucher, setSelectedVoucher] = useState(null)
  const [isFlowOpen, setIsFlowOpen] = useState(false)
  const queryClient = useQueryClient()
  const { tenantContext, getEffectiveRole } = useAuthStore()
  const displayCurrency = tenantContext?.display_currency || 'INR'
  const isTenantUser = getEffectiveRole() === 'tenant_user'

  const { data: wallet } = useQuery({
    queryKey: ['myWallet'],
    queryFn: () => walletsAPI.getMyWallet(),
  })

  const { data: categories } = useQuery({
    queryKey: ['catalogCategories'],
    queryFn: () => catalogAPI.browseCategories(),
  })

  const { data: catalogItems, isLoading: loadingVouchers } = useQuery({
    queryKey: ['catalogBrowse', { category: selectedCategory }],
    queryFn: async () => {
      const params = {}
      if (selectedCategory) params.category = selectedCategory
      const res = await catalogAPI.browse(params)
      return res.data.map(normaliseCatalogItem)
    },
  })

  const { data: redemptions } = useQuery({
    queryKey: ['myRedemptions'],
    queryFn: () => redemptionAPI.getMyRedemptions(),
  })

  const handleRedeem = (voucher) => {
    if (parseFloat(wallet?.data?.balance) < parseFloat(voucher.points_required)) {
      toast.error('Insufficient points balance')
      return
    }
    setSelectedVoucher(voucher)
    setIsFlowOpen(true)
  }

  const filteredVouchers = catalogItems?.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.brand_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const redemptionModal = (
    <RedemptionFlow
      voucher={selectedVoucher}
      isOpen={isFlowOpen}
      onClose={() => { setIsFlowOpen(false); setSelectedVoucher(null) }}
      onSuccess={() => {
        queryClient.invalidateQueries(['myWallet'])
        queryClient.invalidateQueries(['myRedemptions'])
      }}
    />
  )

  // ── Enhanced two-panel view for regular employees ──
  if (isTenantUser) {
    return (
      <>
        <TenantUserRedeemView
          wallet={wallet}
          catalogItems={catalogItems}
          categories={categories}
          redemptions={redemptions}
          loadingVouchers={loadingVouchers}
          onRedeem={handleRedeem}
          displayCurrency={displayCurrency}
          tenantContext={tenantContext}
        />
        {redemptionModal}
      </>
    )
  }

  // ── Standard admin / manager view ──
  return (
    <div className="space-y-6">
      {/* Header with balance */}
      <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm font-medium tracking-wide uppercase">Available Points</p>
            <p className="text-4xl sm:text-5xl font-extrabold mt-1">
              {formatPoints(wallet?.data?.balance || 0, displayCurrency)}
            </p>
          </div>
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
            <HiOutlineGift className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button onClick={() => setActiveTab('catalog')}
          className={`pb-4 px-2 font-medium transition-colors ${activeTab === 'catalog' ? 'text-sparknode-purple border-b-2 border-sparknode-purple' : 'text-gray-500 hover:text-gray-700'}`}>
          Rewards Catalog
        </button>
        <button onClick={() => setActiveTab('history')}
          className={`pb-4 px-2 font-medium transition-colors ${activeTab === 'history' ? 'text-sparknode-purple border-b-2 border-sparknode-purple' : 'text-gray-500 hover:text-gray-700'}`}>
          My Redemptions
        </button>
      </div>

      {activeTab === 'catalog' ? (
        <>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="input pl-12" placeholder="Search rewards..." />
            </div>
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="input md:w-48">
              <option value="">All Categories</option>
              {categories?.data?.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <RewardsCatalog
            vouchers={filteredVouchers}
            isLoading={loadingVouchers}
            balance={wallet?.data?.balance || 0}
            onRedeem={handleRedeem}
            isRedeeming={false}
            displayCurrency={displayCurrency}
            fxRate={parseFloat(tenantContext?.fx_rate) || 1}
          />
        </>
      ) : (
        <RedemptionHistory
          redemptions={redemptions?.data || []}
          displayCurrency={displayCurrency}
        />
      )}

      {redemptionModal}
    </div>
  )
}

