import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  HiOutlineUser, HiOutlinePhone, HiOutlineCheckCircle,
  HiOutlineArrowRight, HiOutlineSparkles,
} from 'react-icons/hi'

const STEPS = ['profile', 'done']

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()

  const [step, setStep] = useState('profile')
  const [firstName, setFirstName] = useState(user?.first_name || '')
  const [lastName, setLastName] = useState(user?.last_name || '')
  const [mobile, setMobile] = useState(user?.mobile_number || '')

  // ── Save profile + mark onboarding complete ────────────────────────────
  const completeMutation = useMutation({
    mutationFn: async () => {
      // Patch user profile
      if (firstName.trim() || lastName.trim() || mobile.trim()) {
        await authAPI.me().then(() => {}) // ensure token valid
        // Update profile via users API if fields changed
        const { usersAPI } = await import('../lib/api')
        if (user?.id) {
          await usersAPI.patch(user.id, {
            ...(firstName.trim() && { first_name: firstName.trim() }),
            ...(lastName.trim() && { last_name: lastName.trim() }),
            ...(mobile.trim() && { mobile_number: mobile.trim() }),
          })
        }
      }
      // Mark onboarding complete
      await authAPI.completeOnboarding()
    },
    onSuccess: () => {
      updateUser({
        first_name: firstName.trim() || user?.first_name,
        last_name: lastName.trim() || user?.last_name,
        mobile_number: mobile.trim() || user?.mobile_number,
        onboarding_completed: true,
      })
      setStep('done')
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail || 'Could not save profile. Please try again.')
    },
  })

  const handleProfile = (e) => {
    e.preventDefault()
    if (!firstName.trim()) return toast.error('First name is required')
    completeMutation.mutate()
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sparknode-purple/10 via-white to-sparknode-blue/10 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <HiOutlineCheckCircle className="w-9 h-9 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h1>
          <p className="text-gray-500 mb-6">Your account is ready. Let's explore your workspace.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full btn-primary h-11 font-bold flex items-center justify-center gap-2"
          >
            <HiOutlineSparkles className="w-5 h-5" />
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sparknode-purple/10 via-white to-sparknode-blue/10 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sparknode-purple to-sparknode-blue px-6 py-5 text-white">
          <h1 className="text-xl font-bold">Welcome to SparkNode 🎉</h1>
          <p className="text-sm text-white/80 mt-1">Let's quickly set up your profile</p>
        </div>

        {/* Profile step */}
        <form onSubmit={handleProfile} className="px-6 py-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <div className="relative">
                <HiOutlineUser className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="input pl-9 h-10 text-sm"
                  placeholder="First name"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="input h-10 text-sm"
                placeholder="Last name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
            <div className="relative">
              <HiOutlinePhone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                className="input pl-9 h-10 text-sm"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={completeMutation.isPending}
              className="w-full btn-primary h-11 font-bold flex items-center justify-center gap-2"
            >
              {completeMutation.isPending ? 'Saving…' : (
                <>
                  Save & Continue
                  <HiOutlineArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-gray-400">
            You can update your profile anytime from Settings.
          </p>
        </form>
      </div>
    </div>
  )
}
