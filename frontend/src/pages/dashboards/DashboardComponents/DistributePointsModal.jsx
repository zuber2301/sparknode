import React from 'react'
import { HiOutlineXMark } from 'react-icons/hi2'

export default function DistributePointsModal({ isOpen, onClose, onSuccess, availablePoints, leads, currency }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900 leading-tight">Distribute Points</h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Movement from Organization pool</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-400">
            <HiOutlineXMark className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8">
          <p className="text-gray-500 mb-8 italic">Point distribution interface will be implemented here.</p>
          <button 
            onClick={onClose}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold uppercase tracking-widests shadow-lg shadow-gray-200"
          >
            Close Management Interface
          </button>
        </div>
      </div>
    </div>
  )
}
