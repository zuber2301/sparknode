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
      <div className="space-y-6">
        <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
        <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Wallet balance card */}
      <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-2xl p-8 text-white">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
            <HiOutlineCash className="w-7 h-7" />
          </div>
          <div>
            <p className="text-white/80 text-sm">Current Balance</p>
            <p className="text-4xl font-bold">{wallet?.data?.balance || 0} points</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <HiOutlineArrowUp className="w-4 h-4 text-green-300" />
              <span className="text-sm text-white/80">Lifetime Earned</span>
            </div>
            <p className="text-2xl font-semibold">{wallet?.data?.lifetime_earned || 0}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <HiOutlineArrowDown className="w-4 h-4 text-red-300" />
              <span className="text-sm text-white/80">Lifetime Spent</span>
            </div>
            <p className="text-2xl font-semibold">{wallet?.data?.lifetime_spent || 0}</p>
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-6">Transaction History</h2>
        
        {ledgerLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : ledger?.data?.length > 0 ? (
          <div className="space-y-3">
            {ledger.data.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    entry.transaction_type === 'credit' 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {entry.transaction_type === 'credit' ? (
                      <HiOutlineArrowUp className="w-5 h-5" />
                    ) : (
                      <HiOutlineArrowDown className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{entry.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge ${getSourceColor(entry.source)}`}>
                        {getSourceLabel(entry.source)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-semibold ${
                    entry.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {entry.transaction_type === 'credit' ? '+' : '-'}{entry.points}
                  </p>
                  <p className="text-sm text-gray-500">
                    Balance: {entry.balance_after}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <HiOutlineCash className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
