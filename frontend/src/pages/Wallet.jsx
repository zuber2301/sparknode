import { useQuery } from '@tanstack/react-query'
import { walletsAPI } from '../lib/api'
import { format } from 'date-fns'
import { HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineCash } from 'react-icons/hi'

export default function Wallet() {
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['myWallet'],
    queryFn: () => walletsAPI.getMyWallet(),
  })

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ['myWalletLedger'],
    queryFn: () => walletsAPI.getMyLedger({ limit: 50 }),
  })

  const getSourceLabel = (source) => {
    const labels = {
      hr_allocation: 'HR Allocation',
      recognition: 'Recognition',
      redemption: 'Redemption',
      adjustment: 'Adjustment',
      expiry: 'Expiry',
      reversal: 'Reversal',
    }
    return labels[source] || source
  }

  const getSourceColor = (source) => {
    const colors = {
      hr_allocation: 'bg-blue-100 text-blue-800',
      recognition: 'bg-green-100 text-green-800',
      redemption: 'bg-purple-100 text-purple-800',
      adjustment: 'bg-yellow-100 text-yellow-800',
      expiry: 'bg-red-100 text-red-800',
      reversal: 'bg-gray-100 text-gray-800',
    }
    return colors[source] || 'bg-gray-100 text-gray-800'
  }

  if (walletLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-32 sm:h-40 bg-gray-200 rounded-lg sm:rounded-xl lg:rounded-2xl animate-pulse" />
        <div className="h-80 sm:h-96 bg-gray-200 rounded-lg sm:rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Wallet balance card */}
      <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-lg sm:rounded-xl lg:rounded-2xl p-4 sm:p-6 lg:p-8 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 mb-4 sm:mb-6">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-lg sm:rounded-2xl flex items-center justify-center flex-shrink-0">
            <HiOutlineCash className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-white/80">Current Balance</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1">{wallet?.data?.balance || 0} points</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
          <div className="bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <HiOutlineArrowUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-300 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-white/80">Lifetime Earned</span>
            </div>
            <p className="text-xl sm:text-2xl font-semibold">{wallet?.data?.lifetime_earned || 0}</p>
          </div>
          <div className="bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <HiOutlineArrowDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-300 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-white/80">Lifetime Spent</span>
            </div>
            <p className="text-xl sm:text-2xl font-semibold">{wallet?.data?.lifetime_spent || 0}</p>
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <div className="card">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6">Transaction History</h2>
        
        {ledgerLoading ? (
          <div className="space-y-3 sm:space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 sm:h-20 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : ledger?.data?.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {ledger.data.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    entry.transaction_type === 'credit' 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {entry.transaction_type === 'credit' ? (
                      <HiOutlineArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <HiOutlineArrowDown className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs sm:text-sm lg:text-base text-gray-900 truncate">{entry.description}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                      <span className={`badge ${getSourceColor(entry.source)}`}>
                        {getSourceLabel(entry.source)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right flex-shrink-0">
                  <p className={`text-base sm:text-lg font-semibold ${
                    entry.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {entry.transaction_type === 'credit' ? '+' : '-'}{entry.points}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Balance: {entry.balance_after}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 sm:py-12 text-gray-500">
            <HiOutlineCash className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm sm:text-base">No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
