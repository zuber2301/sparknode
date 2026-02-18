import React, { useState } from 'react'
import { HiX } from 'react-icons/hi'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { platformAPI } from '../lib/api'

export default function AddBudgetModal({ isOpen, onClose, tenantId }) {
  const [points, setPoints] = useState('1000')
  const [description, setDescription] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (payload) => {
      if (!tenantId) {
        return Promise.reject(new Error('Tenant ID is missing'))
      }
      return platformAPI.addMasterBudget(tenantId, payload)
    },
    onSuccess: () => {
      toast.success('Budget provisioned')
      if (tenantId) {
        queryClient.invalidateQueries(['platformTenant', tenantId])
      }
      queryClient.invalidateQueries(['platformTenants'])
      handleClose()
    },
    onError: (err) => {
      const errorMsg = err.message === 'Tenant ID is missing' 
        ? 'Tenant not properly selected' 
        : err.response?.data?.detail || 'Failed to provision budget'
      toast.error(errorMsg)
    }
  })

  const handleClose = () => {
    setPoints('1000')
    setDescription('')
    onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!tenantId) {
      toast.error('Tenant not properly selected')
      return
    }
    
    const value = Number(points)
    if (!value || value <= 0) {
      toast.error('Enter a positive amount')
      return
    }

    mutation.mutate({ points: value, description })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
          <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <HiX className="w-6 h-6" />
          </button>

          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v8m4-4H8"/></svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Add Budget</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input type="number" value={points} onChange={(e)=>setPoints(e.target.value)} className="mt-2 input-field w-full" min="1" step="0.01" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
              <input type="text" value={description} onChange={(e)=>setDescription(e.target.value)} className="mt-2 input-field w-full" />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">{mutation.isPending ? 'Saving...' : 'Add Budget'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
