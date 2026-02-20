import React from 'react'

export default function SpendingAnalytics({ spendingData, currency }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[400px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Spending Insights</h3>
          <p className="text-xs text-gray-400 font-medium italic mt-1 font-medium italic">Detailed analytics on point circulation</p>
        </div>
      </div>
      <div className="flex items-center justify-center min-h-[300px]">
         <p className="text-gray-400 font-medium italic">Analytics visualization will be available shortly.</p>
      </div>
    </div>
  )
}
