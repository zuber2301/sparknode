import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { authAPI, currentSubdomain, setResolvedTenant } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  HiOutlineMail, HiOutlineKey, HiOutlineArrowLeft,
  HiOutlineShieldCheck, HiOutlineLockClosed, HiOutlineEye,
  HiOutlineEyeOff, HiOutlineLibrary, HiOutlineOfficeBuilding,
  HiOutlineRefresh,
} from 'react-icons/hi'

export default function Login() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('email')   // 'email' | 'otp' | 'password'
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [timer, setTimer] = useState(0)

  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const otpInputRef = useRef(null)

  // ── Resolve tenant from subdomain ────────────────────────────────────────
  const { data: tenantInfo, isLoading: resolvingTenant } = useQuery({
    queryKey: ['tenant-resolve', currentSubdomain],
    queryFn: async () => {
      if (!currentSubdomain) return null
      const res = await authAPI.resolveTenantSlug(currentSubdomain)
      setResolvedTenant(res.data)
      return res.data
    },
    enabled: !!currentSubdomain,
    staleTime: Infinity,
    retry: false,
  })

  const tenantId = tenantInfo?.tenant_id || null

  // ── Countdown timer for OTP resend ───────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) return
    const id = setInterval(() => setTimer(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  // Focus OTP input when we arrive at otp step
  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpInputRef.current?.focus(), 80)
  }, [step])

  const redirectAfterLogin = (user, isNewUser = false) => {
    if (user?.org_role === 'platform_admin') return navigate('/tenants')
    if (isNewUser || user?.onboarding_completed === false) return navigate('/onboarding')
    navigate('/dashboard')
  }

  // ── Request OTP mutation ──────────────────────────────────────────────────
  const requestOtpMutation = useMutation({
    mutationFn: () => authAPI.requestEmailOtp(email.trim().toLowerCase(), tenantId),
    onSuccess: () => {
      setStep('otp')
      setOtp('')
      setTimer(60)
      toast.success('Verification code sent to your email')
    },
    onError: (err) => {
      const detail = err.response?.data?.detail || 'Failed to send code'
      toast.error(detail)
    },
  })

  // ── Verify OTP mutation ───────────────────────────────────────────────────
  const verifyOtpMutation = useMutation({
    mutationFn: () => authAPI.verifyEmailOtp(email.trim().toLowerCase(), otp.trim(), tenantId),
    onSuccess: ({ data }) => {
      const { access_token, user, is_new_user } = data
      setAuth(user, access_token)
      toast.success(is_new_user ? `Welcome to ${tenantInfo?.tenant_name || 'SparkNode'}!` : `Welcome back, ${user.first_name}!`)
      redirectAfterLogin(user, is_new_user)
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Invalid or expired code')
    },
  })

  // ── Password login mutation (secondary) ───────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: () => authAPI.login(email.trim().toLowerCase(), password),
    onSuccess: ({ data }) => {
      const { access_token, user } = data
      setAuth(user, access_token)
      toast.success(`Welcome back, ${user.first_name}!`)
      redirectAfterLogin(user)
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Login failed')
    },
  })

  const handleRequestOtp = (e) => {
    e?.preventDefault()
    if (!email.trim()) return toast.error('Please enter your email')
    requestOtpMutation.mutate()
  }

  const handleVerifyOtp = (e) => {
    e?.preventDefault()
    if (otp.trim().length < 6) return toast.error('Enter the 6-digit code')
    verifyOtpMutation.mutate()
  }

  const handlePasswordLogin = (e) => {
    e.preventDefault()
    loginMutation.mutate()
  }

  const handleSSOLogin = () => {
    toast.error('Enterprise SSO is not configured for this environment yet.')
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sparknode-purple/10 via-white to-sparknode-blue/10 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6 transition-all">

          {/* Logo + branding */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-sparknode-purple/20">
              {tenantInfo?.logo_url
                ? <img src={tenantInfo.logo_url} alt={tenantInfo.tenant_name} className="w-12 h-12 object-contain rounded-lg" />
                : <span className="text-white font-bold text-2xl">SN</span>
              }
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-sparknode-purple to-sparknode-blue bg-clip-text text-transparent">
              {tenantInfo?.tenant_name || 'SparkNode'}
            </h1>
            {tenantInfo ? (
              <div className="flex items-center gap-1.5 mt-1">
                <HiOutlineOfficeBuilding className="w-3.5 h-3.5 text-sparknode-purple" />
                <p className="text-xs text-sparknode-purple font-medium capitalize">{tenantInfo.subscription_tier || 'Workspace'}</p>
              </div>
            ) : (
              <p className="text-gray-500 mt-1 text-sm">Employee Rewards & Recognition</p>
            )}
          </div>

          {/* ── Step: email (primary / default) ────────────────────────────── */}
          {step === 'email' && (
            <div className="space-y-5">
              <form onSubmit={handleRequestOtp} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
                  <div className="relative">
                    <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="input pl-10 h-11"
                      placeholder={tenantInfo ? `you@${currentSubdomain}.com` : 'you@company.com'}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={requestOtpMutation.isPending || resolvingTenant}
                  className="w-full btn-primary h-11 font-bold flex items-center justify-center gap-2"
                >
                  <HiOutlineShieldCheck className="w-5 h-5" />
                  {requestOtpMutation.isPending ? 'Sending code…' : 'Continue with Email OTP'}
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white px-2 text-gray-400 italic">Or</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStep('password')}
                  className="flex items-center justify-center gap-2 py-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-all"
                >
                  <HiOutlineLockClosed className="w-4 h-4" />
                  Password Login
                </button>
                <button
                  type="button"
                  onClick={handleSSOLogin}
                  className="flex items-center justify-center gap-2 py-2.5 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 text-xs font-semibold text-blue-700 transition-all"
                >
                  <HiOutlineLibrary className="w-4 h-4" />
                  Enterprise SSO
                </button>
              </div>
            </div>
          )}

          {/* ── Step: otp verification ──────────────────────────────────────── */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-full mb-3">
                  <HiOutlineShieldCheck className="w-6 h-6 text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Check your inbox</h2>
                <p className="text-sm text-gray-500 mt-1">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-gray-800">{email}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">Verification Code</label>
                <div className="relative">
                  <HiOutlineKey className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="input pl-10 h-12 text-center tracking-[0.6em] text-xl font-bold"
                    placeholder="000000"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={verifyOtpMutation.isPending || otp.length < 6}
                className="w-full btn-primary h-11 font-bold"
              >
                {verifyOtpMutation.isPending ? 'Verifying…' : 'Verify & Sign In'}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtp('') }}
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-800"
                >
                  <HiOutlineArrowLeft className="w-3.5 h-3.5" />
                  Change email
                </button>
                {timer > 0
                  ? <span className="text-gray-400">Resend in {timer}s</span>
                  : (
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={requestOtpMutation.isPending}
                      className="flex items-center gap-1 text-sparknode-purple font-semibold hover:underline disabled:opacity-50"
                    >
                      <HiOutlineRefresh className="w-3.5 h-3.5" />
                      Resend code
                    </button>
                  )
                }
              </div>
            </form>
          )}

          {/* ── Step: password (secondary) ──────────────────────────────────── */}
          {step === 'password' && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-bold text-gray-900">Sign in with password</h2>
              </div>
              <form onSubmit={handlePasswordLogin} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
                  <div className="relative">
                    <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="input pl-10 h-11"
                      placeholder="you@company.com"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <HiOutlineLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="input pl-10 pr-10 h-11"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full btn-primary h-11 font-bold"
                >
                  {loginMutation.isPending ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full text-xs text-gray-500 hover:text-sparknode-purple flex items-center justify-center gap-1"
              >
                <HiOutlineArrowLeft className="w-3.5 h-3.5" />
                Back to Email OTP
              </button>
            </div>
          )}

          {/* Footer sign-up link */}
          <div className="mt-5 pt-4 border-t border-gray-100 text-center text-sm text-gray-500">
            New here?{' '}
            <Link to="/signup" className="font-semibold text-sparknode-purple hover:text-sparknode-blue transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}


export default function Login() {
  const [email, setEmail] = useState('')
  const [mobilePhone, setMobilePhone] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('login') // 'login' or 'otp'
  const [authMethod, setAuthMethod] = useState('email') // 'email' or 'phone'
  const [showPassword, setShowPassword] = useState(false)
  const [timer, setTimer] = useState(0)
  
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const redirectAfterLogin = (user) => {
    if (user?.org_role === 'platform_admin') {
      navigate('/tenants')
    } else {
      navigate('/dashboard')
    }
  }

  useEffect(() => {
    let interval
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timer])

  const requestOtpMutation = useMutation({
    mutationFn: ({ identifier, isEmail }) => authAPI.requestOTP(identifier, isEmail),
    onSuccess: (_, variables) => {
      setStep('otp')
      setTimer(60)
      toast.success(`OTP sent to your ${variables.isEmail ? 'email' : 'phone'}!`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to send OTP')
    },
  })

  const loginMutation = useMutation({
    mutationFn: () => authAPI.login(email, password),
    onSuccess: (response) => {
      const { access_token, user } = response.data
      setAuth(user, access_token)
      toast.success(`Welcome back, ${user.first_name}!`)
      redirectAfterLogin(user)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Login failed')
    },
  })

  const verifyOtpMutation = useMutation({
    mutationFn: () => authAPI.verifyOTP(
      authMethod === 'email' ? email : mobilePhone, 
      otp, 
      authMethod === 'email'
    ),
    onSuccess: (response) => {
      const { access_token, user } = response.data
      setAuth(user, access_token)
      toast.success(`Welcome back, ${user.first_name}!`)
      redirectAfterLogin(user)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Invalid identification code')
    },
  })

  const handleRequestOTP = (method) => {
    setAuthMethod(method)
    if (method === 'email') {
      if (!email) {
        toast.error('Please enter your email first')
        return
      }
      requestOtpMutation.mutate({ identifier: email, isEmail: true })
    } else {
      if (!mobilePhone || mobilePhone.length < 13) { // +91 and 10 digits
        toast.error('Please enter a valid mobile number')
        return
      }
      requestOtpMutation.mutate({ identifier: mobilePhone, isEmail: false })
    }
  }

  const handleVerifyOTP = (e) => {
    e.preventDefault()
    verifyOtpMutation.mutate()
  }

  const handlePasswordLogin = (e) => {
    e.preventDefault()
    loginMutation.mutate()
  }

  const handleSSOLogin = () => {
    toast.error('Enterprise SSO is not configured for this environment yet.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-perksu-purple/10 via-white to-perksu-blue/10 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6 transition-all">
          {/* Logo */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-lg flex items-center justify-center mb-3 shadow-lg shadow-sparknode-purple/20">
              <span className="text-white font-bold text-2xl">SN</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-sparknode-purple to-sparknode-blue bg-clip-text text-transparent">
              SparkNode
            </h1>
            <p className="text-gray-500 mt-1">Employee Rewards & Recognition</p>
          </div>

          {step === 'login' ? (
            /* Primary Login Options */
            <div className="space-y-5">
              <form onSubmit={handlePasswordLogin} className="space-y-3">
                <div>
                  <label className="label py-1">User name (Email)</label>
                  <div className="relative">
                    <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input pl-10 h-10"
                      placeholder="you@company.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label py-1">Password</label>
                  <div className="relative">
                    <HiOutlineLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pl-10 pr-10 h-10"
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
                  className="w-full btn-primary h-10 font-bold"
                >
                  {loginMutation.isPending ? 'Signing in...' : 'Sign In with Password'}
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white px-2 text-gray-400 italic">Or verification via</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('email_entry')}
                    disabled={requestOtpMutation.isPending}
                    className="flex flex-col items-center justify-center py-2 bg-purple-50 border border-purple-100 rounded-xl hover:bg-purple-100 transition-all group"
                  >
                    <HiOutlineShieldCheck className="w-6 h-6 text-perksu-purple mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-bold text-perksu-purple uppercase tracking-wider">Email OTP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('phone_entry')}
                    disabled={requestOtpMutation.isPending}
                    className="flex flex-col items-center justify-center py-2 bg-orange-50 border border-orange-100 rounded-xl hover:bg-orange-100 transition-all group"
                  >
                    <HiOutlinePhone className="w-6 h-6 text-perksu-orange mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-bold text-perksu-orange uppercase tracking-wider">SMS OTP</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSSOLogin}
                  className="w-full py-2 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-2 group"
                >
                  <HiOutlineLibrary className="w-6 h-6 text-perksu-blue group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-perksu-blue uppercase tracking-widest">Enterprise SSO Login</span>
                </button>
              </div>
            </div>
          ) : step === 'email_entry' ? (
            /* Email Entry Step */
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-gray-900">Email Verification</h2>
                <p className="text-xs text-gray-500">Enter your registered work email</p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="label py-1">Email Address</label>
                  <div className="relative">
                    <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input pl-10 h-10"
                      placeholder="you@company.com"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleRequestOTP('email')}
                  disabled={requestOtpMutation.isPending}
                  className="w-full btn-primary h-10 font-bold"
                >
                  {requestOtpMutation.isPending ? 'Sending...' : 'Send OTP via Email'}
                </button>

                <button
                  onClick={() => setStep('login')}
                  className="w-full text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  Go Back
                </button>
              </div>
            </div>
          ) : step === 'phone_entry' ? (
            /* SMS Phone Entry Step */
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-gray-900">SMS Verification</h2>
                <p className="text-xs text-gray-500">Enter your registered mobile number</p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="label py-1">Mobile Number</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">+91</span>
                    <input
                      type="tel"
                      value={mobilePhone.replace('+91', '')}
                      onChange={(e) => setMobilePhone('+91' + e.target.value.replace(/[^0-9]/g, ''))}
                      className="input pl-12 h-10"
                      placeholder="98765 43210"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleRequestOTP('phone')}
                  disabled={requestOtpMutation.isPending}
                  className="w-full btn-primary h-10 font-bold"
                >
                  {requestOtpMutation.isPending ? 'Sending...' : 'Send OTP via SMS'}
                </button>

                <button
                  onClick={() => setStep('login')}
                  className="w-full text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  Go Back
                </button>
              </div>
            </div>
          ) : (
            /* OTP Verification Step */
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-green-50 rounded-full mb-2">
                  <HiOutlineShieldCheck className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Verify Code</h2>
                <p className="text-xs text-gray-500">
                  Sent to <span className="font-medium text-gray-900">{authMethod === 'email' ? email : mobilePhone}</span>
                </p>
              </div>

              <div>
                <label className="label py-1 font-semibold text-gray-700 text-xs text-center block">Verification Code</label>
                <div className="relative">
                  <HiOutlineKey className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    maxLength="6"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    className="input pl-10 h-10 text-center tracking-[0.5em] text-lg font-bold"
                    placeholder="000000"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={verifyOtpMutation.isPending}
                className="w-full btn-primary h-10"
              >
                {verifyOtpMutation.isPending ? 'Verifying...' : 'Log In'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('login')}
                  className="text-xs text-gray-500 hover:text-perksu-purple flex items-center justify-center gap-1 mx-auto"
                >
                  <HiOutlineArrowLeft className="w-3 h-3" />
                  Go back to Password Login
                </button>
                <div className="mt-2">
                  {timer > 0 ? (
                    <p className="text-[10px] text-gray-400">Resend in {timer}s</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => requestOtpMutation.mutate({ 
                        identifier: authMethod === 'email' ? email : mobilePhone, 
                        isEmail: authMethod === 'email' 
                      })}
                      className="text-[10px] font-semibold text-perksu-purple hover:underline"
                    >
                      Resend Code
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}

          {/* Sign up link */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600 text-center">
              New to Perksu?{' '}
              <Link to="/signup" className="font-semibold text-perksu-purple hover:text-perksu-blue transition-colors">
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
