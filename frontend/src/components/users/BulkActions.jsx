/**
 * Bulk Actions Component
 * 
 * Actions for selected users (deactivate, resend invites).
 */

import { HiOutlineMail, HiOutlineTrash } from 'react-icons/hi'

export default function BulkActions({
  selectedCount,
  onBulkDeactivate,
  onBulkResendInvites,
  isDeactivating,
  isResending
}) {
  if (selectedCount === 0) return null

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
      <span className="text-indigo-700 font-medium">
        {selectedCount} user{selectedCount > 1 ? 's' : ''} selected
      </span>
      <div className="flex gap-2">
        <button
          onClick={onBulkResendInvites}
          disabled={isResending}
          className="btn btn-secondary text-sm"
        >
          <HiOutlineMail className="w-4 h-4 mr-1" />
          {isResending ? 'Sending...' : 'Resend Invites'}
        </button>
        <button
          onClick={onBulkDeactivate}
          disabled={isDeactivating}
          className="btn bg-red-600 text-white hover:bg-red-700 text-sm"
        >
          <HiOutlineTrash className="w-4 h-4 mr-1" />
          {isDeactivating ? 'Deactivating...' : 'Deactivate'}
        </button>
      </div>
    </div>
  )
}
