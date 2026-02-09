import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { redemptionAPI, walletsAPI } from '../lib/api'
import toast from 'react-hot-toast'
import { HiOutlineGift, HiOutlineSearch, HiOutlineFilter, HiOutlineCheck } from 'react-icons/hi'
import RewardsCatalog from '../components/RewardsCatalog'
import RedemptionHistory from '../components/RedemptionHistory'

export default function Redeem() {
  const [activeTab, setActiveTab] = useState('catalog')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVoucher, setSelectedVoucher] = useState(null)
  const queryClient = useQueryClient()

  const { data: wallet } = useQuery({
    queryKey: ['myWallet'],
    queryFn: () => walletsAPI.getMyWallet(),
  })

  const { data: categories } = useQuery({
    queryKey: ['voucherCategories'],
    queryFn: () => redemptionAPI.getCategories(),
  })

  const { data: vouchers, isLoading: loadingVouchers } = useQuery({
    queryKey: ['vouchers', { category: selectedCategory }],
    queryFn: () => redemptionAPI.getVouchers({ category: selectedCategory || undefined }),
  })

  const { data: redemptions } = useQuery({
    queryKey: ['myRedemptions'],
    queryFn: () => redemptionAPI.getMyRedemptions(),
  })

  const redeemMutation = useMutation({
    mutationFn: (data) => redemptionAPI.create(data),
    onSuccess: (response) => {
      toast.success('Redemption successful! 🎉')
      queryClient.invalidateQueries(['myWallet'])
      queryClient.invalidateQueries(['myRedemptions'])
      setSelectedVoucher(response.data)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Redemption failed')
    },
  })

  const handleRedeem = (voucher) => {
    if (parseFloat(wallet?.data?.balance) < parseFloat(voucher.points_required)) {
      toast.error('Insufficient points balance')
      return
    }
    
    if (confirm(`Redeem ${voucher.name} for ${voucher.points_required} points?`)) {
      redeemMutation.mutate({ voucher_id: voucher.id })
    }
  }

  const filteredVouchers = vouchers?.data?.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.brand_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-4 px-2 font-medium transition-colors ${
            activeTab === 'catalog'
              ? 'text-sparknode-purple border-b-2 border-sparknode-purple'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Rewards Catalog
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-4 px-2 font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-sparknode-purple border-b-2 border-sparknode-purple'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          My Redemptions
        </button>
      </div>

      {activeTab === 'catalog' ? (
        <>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-12"
                placeholder="Search rewards..."
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input md:w-48"
            >
              <option value="">All Categories</option>
              {categories?.data?.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Catalog */}
          <RewardsCatalog
            vouchers={filteredVouchers || []}
            isLoading={loadingVouchers}
            balance={wallet?.data?.balance || 0}
            onRedeem={handleRedeem}
            isRedeeming={redeemMutation.isPending}
          />
        </>
      ) : (
        <RedemptionHistory redemptions={redemptions?.data || []} />
      )}

      {/* Success modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <HiOutlineCheck className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Redemption Successful!</h2>
            <p className="text-gray-500 mb-6">{selectedVoucher.voucher_name}</p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-500 mb-1">Your Voucher Code</p>
              <p className="text-2xl font-mono font-bold text-gray-900">{selectedVoucher.voucher_code}</p>
              {selectedVoucher.voucher_pin && (
                <>
                  <p className="text-sm text-gray-500 mt-3 mb-1">PIN</p>
                  <p className="text-xl font-mono font-bold text-gray-900">{selectedVoucher.voucher_pin}</p>
                </>
              )}
            </div>

            <button
              onClick={() => setSelectedVoucher(null)}
              className="btn-primary w-full"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
