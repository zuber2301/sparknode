import { useState } from 'react'
import { HiOutlineGift, HiOutlineSearch, HiOutlineFilter } from 'react-icons/hi'
import { formatCurrency } from '../lib/currency'

export default function RewardsCatalog({ 
  vouchers, 
  onRedeem, 
  isRedeeming, 
  balance = 0,
  displayCurrency = 'INR',
  fxRate = 1
}) {
  const [search, setSearch] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [sortBy, setSortBy] = useState('points_asc')

  const brands = [...new Set(vouchers?.map(v => v.brand_name) || [])]

  const filteredVouchers = vouchers?.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) ||
                          v.brand_name.toLowerCase().includes(search.toLowerCase())
    const matchesBrand = !selectedBrand || v.brand_name === selectedBrand
    return matchesSearch && matchesBrand
  }).sort((a, b) => {
    switch (sortBy) {
      case 'points_asc':
        return a.points_required - b.points_required
      case 'points_desc':
        return b.points_required - a.points_required
      case 'name':
        return a.name.localeCompare(b.name)
      default:
        return 0
    }
  }) || []

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rewards..."
            className="input-field w-full pl-10"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="input-field"
          >
            <option value="">All Brands</option>
            {brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field"
          >
            <option value="points_asc">Points: Low to High</option>
            <option value="points_desc">Points: High to Low</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {/* Rewards Grid */}
      {filteredVouchers.length === 0 ? (
        <div className="text-center py-12">
          <HiOutlineGift className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No rewards found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVouchers.map(voucher => {
            // Check if brand_logo is an emoji (not a URL path)
            const isEmoji = voucher.brand_logo && !voucher.brand_logo.startsWith('/')

            return (
              <div key={voucher.id} className="card hover:shadow-lg transition">
                {/* Brand Logo / Image */}
                <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center mb-4">
                  {voucher.brand_logo && isEmoji ? (
                    <span className="text-6xl">{voucher.brand_logo}</span>
                  ) : voucher.brand_logo ? (
                    <img
                      src={voucher.brand_logo}
                      alt={voucher.brand_name}
                      className="h-16 object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  {(!voucher.brand_logo || !isEmoji) && (
                    <div className={`text-4xl font-bold text-gray-300 ${voucher.brand_logo && !isEmoji ? 'hidden' : ''}`}>
                      {voucher.brand_name?.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Voucher Info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{voucher.brand_name}</p>
                      <h3 className="font-semibold text-gray-900">{voucher.name}</h3>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sparknode-purple/10 text-sparknode-purple">
                      {formatCurrency(voucher.denomination || voucher.face_value, displayCurrency, fxRate)}
                    </span>
                  </div>

                  {voucher.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {voucher.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <span className="text-2xl font-bold text-sparknode-purple">
                        {Number(voucher.points_required).toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">pts</span>
                    </div>

                    <button
                      onClick={() => onRedeem(voucher)}
                      disabled={isRedeeming || balance < voucher.points_required}
                      className={`btn-primary text-sm ${
                        balance < voucher.points_required
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      }`}
                    >
                      {balance < voucher.points_required ? 'Not Enough Points' : 'Redeem'}
                    </button>
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
