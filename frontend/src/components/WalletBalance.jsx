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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm">Points Balance</p>
          <p className="text-3xl font-bold">{wallet.balance}</p>
        </div>
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <HiOutlineCash className="w-6 h-6" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-white/20 flex justify-between text-sm">
        <span className="text-white/80">Earned: {wallet.lifetime_earned}</span>
        <span className="text-white/80">Spent: {wallet.lifetime_spent}</span>
      </div>
    </div>
  )
}
