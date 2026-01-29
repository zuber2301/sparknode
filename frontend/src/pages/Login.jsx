import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showEmailOtp, setShowEmailOtp] = useState(false)
  const [showSmsOtp, setShowSmsOtp] = useState(false)
  const [emailAddress, setEmailAddress] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [smsOtp, setSmsOtp] = useState('')
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const loginMutation = useMutation({
    mutationFn: () => authAPI.login(username, password),
    onSuccess: (response) => {
      const { access_token, user } = response.data
      setAuth(user, access_token)
      toast.success(`Welcome back, ${user.first_name}!`)
      navigate('/dashboard')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Login failed')
    },
  })

  const emailOtpRequestMutation = useMutation({
    mutationFn: () => authAPI.requestEmailOtp(emailAddress),
    onSuccess: () => {
      toast.success('OTP sent to email')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to send email OTP')
    },
  })

  const emailOtpVerifyMutation = useMutation({
    mutationFn: () => authAPI.verifyEmailOtp(emailAddress, emailOtp),
    onSuccess: () => {
      toast.success('Email OTP verified')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Invalid email OTP')
    },
  })

  const smsOtpRequestMutation = useMutation({
    mutationFn: () => authAPI.requestSmsOtp(mobileNumber),
    onSuccess: () => {
      toast.success('OTP sent to mobile')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to send SMS OTP')
    },
  })

  const smsOtpVerifyMutation = useMutation({
    mutationFn: () => authAPI.verifySmsOtp(mobileNumber, smsOtp),
    onSuccess: () => {
      toast.success('SMS OTP verified')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Invalid SMS OTP')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    loginMutation.mutate()
  }

  const handleEmailOtpRequest = () => {
    if (!emailAddress) {
      toast.error('Enter email address')
      return
    }
    emailOtpRequestMutation.mutate()
  }

  const handleEmailOtpVerify = () => {
    if (!emailAddress || !emailOtp) {
      toast.error('Enter email and OTP')
      return
    }
    emailOtpVerifyMutation.mutate()
  }

  const handleSmsOtpRequest = () => {
    if (!mobileNumber) {
      toast.error('Enter mobile number')
      return
    }
    smsOtpRequestMutation.mutate()
  }

  const handleSmsOtpVerify = () => {
    if (!mobileNumber || !smsOtp) {
      toast.error('Enter mobile number and OTP')
      return
    }
    smsOtpVerifyMutation.mutate()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sparknode-purple/10 via-white to-sparknode-blue/10">
      <div className="w-full max-w-md p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-2xl mb-3">
              <span className="text-2xl font-bold text-white">SN</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-sparknode-purple to-sparknode-blue bg-clip-text text-transparent">
              SparkNode
            </h1>
            <p className="text-gray-500 mt-1">Employee Rewards & Recognition</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">User name</label>
              <div className="relative">
                <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input pl-10"
                  placeholder="username or corporate email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <HiOutlineLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <HiOutlineEyeOff className="w-5 h-5" />
                  ) : (
                    <HiOutlineEye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full btn-primary py-2.5"
            >
              {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="w-full btn-secondary py-2"
                onClick={() => setShowEmailOtp((prev) => !prev)}
              >
                Email OTP
              </button>
              <button
                type="button"
                className="w-full btn-secondary py-2"
                onClick={() => setShowSmsOtp((prev) => !prev)}
              >
                SMS OTP
              </button>
            </div>

            {showEmailOtp && (
              <div className="space-y-3">
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="input"
                    placeholder="you@company.com"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="btn-secondary py-2 px-4"
                    onClick={handleEmailOtpRequest}
                    disabled={emailOtpRequestMutation.isPending}
                  >
                    {emailOtpRequestMutation.isPending ? 'Sending...' : 'Generate OTP'}
                  </button>
                  <input
                    type="text"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    className="input"
                    placeholder="Enter OTP"
                  />
                  <button
                    type="button"
                    className="btn-primary py-2 px-4"
                    onClick={handleEmailOtpVerify}
                    disabled={emailOtpVerifyMutation.isPending}
                  >
                    {emailOtpVerifyMutation.isPending ? 'Verifying...' : 'Submit OTP'}
                  </button>
                </div>
              </div>
            )}

            {showSmsOtp && (
              <div className="space-y-3">
                <div>
                  <label className="label">Mobile number</label>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="input"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="btn-secondary py-2 px-4"
                    onClick={handleSmsOtpRequest}
                    disabled={smsOtpRequestMutation.isPending}
                  >
                    {smsOtpRequestMutation.isPending ? 'Sending...' : 'Generate OTP'}
                  </button>
                  <input
                    type="text"
                    value={smsOtp}
                    onChange={(e) => setSmsOtp(e.target.value)}
                    className="input"
                    placeholder="Enter OTP"
                  />
                  <button
                    type="button"
                    className="btn-primary py-2 px-4"
                    onClick={handleSmsOtpVerify}
                    disabled={smsOtpVerifyMutation.isPending}
                  >
                    {smsOtpVerifyMutation.isPending ? 'Verifying...' : 'Submit OTP'}
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              className="w-full btn-secondary py-2"
            >
              SSO
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
