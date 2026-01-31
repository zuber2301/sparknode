import { HiOutlineCash } from 'react-icons/hi'

export default function WalletBalance({ wallet }) {
  if (!wallet) {
    return (
      <div className="stat-card animate-pulse">
        <div className="h-20 bg-gray-200 rounded" />
      </div>
    )
  }

  return (
    <div className="stat-card bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="flex-1">
          <p className="text-xs sm:text-sm text-white/80">Points Balance</p>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1">{wallet.balance}</p>
        </div>
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
          <HiOutlineCash className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>
      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20 flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-3 text-xs sm:text-sm">
        <span className="text-white/80">Earned: {wallet.lifetime_earned}</span>
        <span className="text-white/80">Spent: {wallet.lifetime_spent}</span>
      </div>
    </div>
  )
}
