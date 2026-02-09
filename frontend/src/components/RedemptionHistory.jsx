import { formatDistanceToNow } from 'date-fns'
import { HiOutlineGift, HiOutlineCheck, HiOutlineClock, HiOutlineX } from 'react-icons/hi'

export default function RedemptionHistory({ redemptions }) {
  if (!redemptions?.length) {
    return (
      <div className="text-center py-12">
        <HiOutlineGift className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No redemptions yet</p>
        <p className="text-sm text-gray-400 mt-1">Your redeemed rewards will appear here</p>
      </div>
    )
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
      case 'fulfilled':
        return <HiOutlineCheck className="w-5 h-5 text-green-500" />
      case 'pending':
      case 'pending_otp':
      case 'processing':
        return <HiOutlineClock className="w-5 h-5 text-yellow-500" />
      case 'failed':
        return <HiOutlineX className="w-5 h-5 text-red-500" />
      default:
        return <HiOutlineClock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      fulfilled: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      pending_otp: 'bg-amber-100 text-amber-800',
      failed: 'bg-red-100 text-red-800',
      processing: 'bg-blue-100 text-blue-800'
    }
    return `px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`
  }

  return (
    <div className="space-y-4">
      {redemptions.map(redemption => (
        <div 
          key={redemption.id} 
          className="card flex items-center space-x-4"
        >
          {/* Status Icon */}
          <div className="flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              (redemption.status === 'completed' || redemption.status === 'fulfilled') ? 'bg-green-100' :
              (redemption.status === 'pending' || redemption.status === 'pending_otp') ? 'bg-yellow-100' :
              redemption.status === 'failed' ? 'bg-red-100' : 'bg-gray-100'
            }`}>
              {getStatusIcon(redemption.status)}
            </div>
          </div>

          {/* Redemption Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-medium text-gray-900 truncate">
                {redemption.voucher_name || 'Reward'}
              </h3>
              <span className={getStatusBadge(redemption.status)}>
                {redemption.status}
              </span>
            </div>
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
              <span>{redemption.brand_name}</span>
              <span>•</span>
              <span>{redemption.points_used || redemption.points_spent} points</span>
              <span>•</span>
              <span>
                {formatDistanceToNow(new Date(redemption.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Voucher Code (if fulfilled) */}
          {(redemption.status === 'completed' || redemption.status === 'fulfilled') && redemption.voucher_code && (
            <div className="flex-shrink-0 text-right">
              <p className="text-xs text-gray-500">Voucher Code</p>
              <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                {redemption.voucher_code}
              </code>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
