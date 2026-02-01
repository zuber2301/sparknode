import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff, HiOutlineUser, HiOutlinePhone } from 'react-icons/hi'

/**
 * Signup Page with Tenant-Aware Onboarding
 * 
 * Implements the "Hard Link" tenant-user mapping:
 * 1. Domain-Match Auto-Onboarding: Email domain automatically matched to organization
 * 2. Invite-Link Method: Join via secure token from organization invite
 * 
 * Features:
 * - Auto-detect organization by email domain
 * - Accept invitation tokens from join links
 * - Real-time validation
 * - Tenant context inclusion in JWT
 */
export default function Signup() {
  const [searchParams] = useSearchParams()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    personal_email: '',
    mobile_number: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [invitationToken, setInvitationToken] = useState(null)
  const [detectedTenant, setDetectedTenant] = useState(null)
  const [loadingTenant, setLoadingTenant] = useState(false)
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  // Check for invitation token in URL
  useEffect(() => {
    const token = searchParams.get('token')
    const email = searchParams.get('email')
    if (token) {
      setInvitationToken(token)
      if (email) {
        setFormData(prev => ({ ...prev, email: email }))
      }
    }
  }, [searchParams])

  // Auto-detect tenant from email domain (domain-match onboarding)
  const detectTenantFromDomain = async (email) => {
    if (!email || !email.includes('@')) {
      setDetectedTenant(null)
      return
    }

    setLoadingTenant(true)
    try {
      const domain = email.split('@')[1]
      // This is a client-side hint - the server will verify the actual domain whitelist
      setDetectedTenant({
        domain,
        status: 'detected', // Pending server verification
        message: `Looking for organization with domain @${domain}...`
      })
    } finally {
      setLoadingTenant(false)
    }
  }

  // Debounce email changes to check for organization
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.email && !invitationToken) {
        detectTenantFromDomain(formData.email)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [formData.email, invitationToken])

  const signupMutation = useMutation({
    mutationFn: (data) => authAPI.signup(
      data.email,
      data.password,
      data.first_name,
      data.last_name,
      data.personal_email,
      data.mobile_number,
      invitationToken
    ),
    onSuccess: (response) => {
      const { access_token, user, tenant_name, resolution_method } = response.data
      setAuth(user, access_token)
      
      let welcomeMessage = `Welcome to ${tenant_name}!`
      if (resolution_method === 'domain') {
        welcomeMessage = `Welcome! You've been automatically enrolled in ${tenant_name} based on your email domain.`
      } else if (resolution_method === 'token') {
        welcomeMessage = `Welcome! You've successfully joined ${tenant_name}.`
      }
      
      toast.success(welcomeMessage)
      navigate('/dashboard')
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.detail || 'Signup failed'
      toast.error(errorMessage)
      
      // Special messaging for common errors
      if (errorMessage.includes('already registered')) {
        toast.error('This email is already registered. Please log in instead.')
      } else if (errorMessage.includes('no associated organization')) {
        toast.error('No organization found for your email domain. Please request an invitation.')
      } else if (errorMessage.includes('organization')) {
        toast.error('There was an issue with organization assignment. Please contact support.')
      }
    },
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
      toast.error('Please fill in all required fields')
      return false
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return false
    }

    if (!agreeToTerms) {
      toast.error('Please agree to the Terms of Service')
      return false
    }

    if (!invitationToken && !detectedTenant) {
      toast.error('Unable to verify organization. Please check your email or request an invitation.')
      return false
    }

    return true
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validateForm()) {
      signupMutation.mutate(formData)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
            <p className="text-gray-600">
              {invitationToken 
                ? 'Join your organization with the invitation link' 
                : 'Sign up to get started with SparkNode'}
            </p>
          </div>

          {/* Organization Detection Info */}
          {detectedTenant && !invitationToken && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Organization detected:</span> {detectedTenant.message}
              </p>
            </div>
          )}

          {/* Invitation Info */}
          {invitationToken && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <span className="font-semibold">✓ Invitation accepted.</span> Complete your profile to join.
              </p>
            </div>
          )}

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work Email *
              </label>
              <div className="relative">
                <HiOutlineMail className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  disabled={!!invitationToken}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  required
                />
              </div>
              {loadingTenant && (
                <p className="text-xs text-blue-600 mt-1">Checking organization...</p>
              )}
            </div>

            {/* First Name & Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <div className="relative">
                  <HiOutlineUser className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="John"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Doe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <HiOutlineLockClosed className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400"
                >
                  {showPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password *
              </label>
              <div className="relative">
                <HiOutlineLockClosed className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-gray-400"
                >
                  {showConfirmPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Optional Fields */}
            <div className="pt-2">
              <p className="text-xs text-gray-600 mb-3">Optional Information</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Personal Email
                  </label>
                  <input
                    type="email"
                    name="personal_email"
                    value={formData.personal_email}
                    onChange={handleChange}
                    placeholder="personal@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <HiOutlinePhone className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      name="mobile_number"
                      value={formData.mobile_number}
                      onChange={handleChange}
                      placeholder="+1 (555) 000-0000"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="flex items-start space-x-2 pt-2">
              <input
                type="checkbox"
                id="terms"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                required
              />
              <label htmlFor="terms" className="text-sm text-gray-700">
                I agree to the{' '}
                <a href="/terms" className="text-blue-600 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>
                <span className="text-red-500">*</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={signupMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 mt-6"
            >
              {signupMutation.isPending ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <a href="/login" className="text-blue-600 hover:underline font-medium">
                Log in here
              </a>
            </p>
          </div>

          {/* Help Text */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Need help?</span> If you don't have an invitation link or your organization isn't recognized, 
              contact your HR administrator or{' '}
              <a href="/support" className="text-blue-600 hover:underline">
                request support
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
