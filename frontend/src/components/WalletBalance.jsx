import { HiOutlineCash } from 'react-icons/hi'
import { useQuery } from '@tanstack/react-query'
import { tenantsAPI } from '../lib/api'
import { formatCurrency, formatPoints } from '../lib/currency'

export default function WalletBalance({ wallet }) {
  // Fetch tenant config to get currency settings
  const { data: tenantData } = useQuery({
    queryKey: ['tenant', 'current'],
    queryFn: () => tenantsAPI.getCurrentTenant()
  })

  if (!wallet) {
    return (
      <div className="stat-card stat-card-compact animate-pulse">
        <div className="h-16 bg-gray-200 rounded" />
      </div>
    )
  }

  // Get currency display settings
  const displayCurrency = tenantData?.display_currency || 'USD'
  const fxRate = parseFloat(tenantData?.fx_rate) || 1.0

  // Format wallet values as points using Rupee symbol and integer values
  const formattedBalance = formatPoints(wallet.balance)
  const formattedEarned = formatPoints(wallet.lifetime_earned)
  const formattedSpent = formatPoints(wallet.lifetime_spent)

  return (
    <div className="stat-card stat-card-compact bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="flex-1">
          <p className="text-xs sm:text-sm text-white/80">Points Balance</p>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1">{formattedBalance}</p>
        </div>
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
          <HiOutlineCash className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>
      <div className="stat-compact-footer">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-3">
          <span className="text-white/80">Earned: {formattedEarned}</span>
          <span className="text-white/80">Spent: {formattedSpent}</span>
        </div>
      </div>
    </div>
  )
}

