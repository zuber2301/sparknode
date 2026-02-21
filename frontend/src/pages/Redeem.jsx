import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { catalogAPI, walletsAPI, redemptionAPI } from '../lib/api'
import toast from 'react-hot-toast'
import { HiOutlineGift, HiOutlineSearch } from 'react-icons/hi'
import RewardsCatalog from '../components/RewardsCatalog'
import RedemptionHistory from '../components/RedemptionHistory'
import RedemptionFlow from '../components/RedemptionFlow'

/** Normalise a catalog browse item into the shape RewardsCatalog + RedemptionFlow expect */
function normaliseCatalogItem(item) {
  return {
    ...item,
    // Fields RewardsCatalog reads
    brand_name: item.brand,
    brand_logo: item.image_url || null,
    points_required: item.min_points,
    denomination: item.min_points,   // single‑denom display
    // Pass through legacy voucher id for the redemption flow
    id: item.source_voucher_id || item.id,
    catalog_item_id: item.id,
    catalog_source: item.source,
  }
}

export default function Redeem() {
  const [activeTab, setActiveTab] = useState('catalog')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVoucher, setSelectedVoucher] = useState(null)
  const [isFlowOpen, setIsFlowOpen] = useState(false)
  const queryClient = useQueryClient()

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

  return (
    <div className="space-y-6">
      {/* Header with balance */}
      <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">Available Points</p>
            <p className="text-4xl font-bold">{wallet?.data?.balance || 0}</p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
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

          {/* Catalog */}
          <RewardsCatalog
            vouchers={filteredVouchers}
            isLoading={loadingVouchers}
            balance={wallet?.data?.balance || 0}
            onRedeem={handleRedeem}
            isRedeeming={false}
          />
        </>
      ) : (
        <RedemptionHistory redemptions={redemptions?.data || []} />
      )}

      {/* Redemption Workflow Modal */}
      <RedemptionFlow
        voucher={selectedVoucher}
        isOpen={isFlowOpen}
        onClose={() => { setIsFlowOpen(false); setSelectedVoucher(null) }}
        onSuccess={() => {
          queryClient.invalidateQueries(['myWallet'])
          queryClient.invalidateQueries(['myRedemptions'])
        }}
      />
    </div>
  )
}

