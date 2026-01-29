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
  const [emailOtp, setEmailOtp] = useState('')
  const [smsOtp, setSmsOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  const handleSubmit = (e) => {
    e.preventDefault()
    loginMutation.mutate()
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

            <div>
              <label className="label">Email OTP</label>
              <input
                type="text"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value)}
                className="input"
                placeholder="Enter email OTP"
              />
            </div>

            <div>
              <label className="label">SMS OTP</label>
              <input
                type="text"
                value={smsOtp}
                onChange={(e) => setSmsOtp(e.target.value)}
                className="input"
                placeholder="Enter SMS OTP"
              />
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full btn-primary py-2.5"
            >
              {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              className="w-full btn-secondary py-2.5"
            >
              Continue with SSO
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
