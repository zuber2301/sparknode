import React from 'react'

export default function DelegationStatusTable({ leads, currency, onRefresh }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-50">
        <h3 className="text-lg font-bold text-gray-900">Lead Delegation Status</h3>
      </div>
      <div className="p-12 text-center">
        <p className="text-gray-400 font-medium italic">Delegation tracking for {leads.length} leads will appear here.</p>
      </div>
    </div>
  )
}
