import React from 'react'
import { formatDistanceToNow } from 'date-fns'

export default function RecentRecognitionFeed({ recognitions, onRefresh }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Recent Engagement</h3>
        <button onClick={onRefresh} className="text-[10px] font-bold text-sparknode-purple uppercase tracking-widest">Refresh Feed</button>
      </div>
      <div className="divide-y divide-gray-50">
        {recognitions.length > 0 ? recognitions.map((item) => (
          <div key={item.id} className="p-6 hover:bg-gray-50/50 transition">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 mb-1">
                  {item.from_user} <span className="text-gray-400 font-medium">recognized</span> {item.to_user}
                </p>
                <p className="text-xs text-gray-500 leading-relaxed italic">"{item.message}"</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="text-sm font-black text-sparknode-purple mb-1">+{item.points} pts</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        )) : (
          <div className="p-12 text-center text-gray-400">No recognition activities yet.</div>
        )}
      </div>
    </div>
  )
}
