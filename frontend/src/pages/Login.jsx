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
  HiOutlineRefresh, HiOutlinePhone,
} from 'react-icons/hi'

export default function Login() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  // steps: 'password' | 'email' | 'otp' | 'sms' | 'sms_otp'
  const [step, setStep] = useState('password')
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [timer, setTimer] = useState(0)
  const [mobile, setMobile] = useState('')
  const [smsOtp, setSmsOtp] = useState('')
  const [smsTimer, setSmsTimer] = useState(0)

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

  // ── Countdown timers for OTP resend ──────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) return
    const id = setInterval(() => setTimer(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  useEffect(() => {
    if (smsTimer <= 0) return
    const id = setInterval(() => setSmsTimer(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [smsTimer])

  // Focus OTP input when we arrive at otp step
  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpInputRef.current?.focus(), 80)
  }, [step])

  const redirectAfterLogin = (user, isNewUser = false) => {
    if (user?.org_role === 'platform_admin') return navigate('/tenants')
    if (isNewUser || user?.onboarding_completed === false) return navigate('/onboarding')

    // Determine module access from enabled_modules (new) or feature flags (legacy)
    const modules = user?.enabled_modules
    let sparkAccess = true
    let igniteAccess = false

    if (modules) {
      sparkAccess = !!modules.sparknode
      igniteAccess = !!modules.ignitenode
    } else {
      const flags = user?.tenant_flags || {}
      igniteAccess = !!(
        flags.sales_marketing ||
        flags.sales_marketing_enabled ||
        flags.sales_marketting_enabled
      )
    }

    const hasBoth = sparkAccess && igniteAccess

    // If user has a preferred module set, skip the Gateway chooser
    if (hasBoth && user?.primary_module === 'ignitenode') return navigate('/sales-events')
    if (hasBoth && user?.primary_module === 'sparknode')  return navigate('/dashboard')

    // Three scenarios:
    // 1. Both modules, no preference → show module selector (Gateway)
    if (hasBoth) return navigate('/gateway')
    // 2. IgniteNode only → go directly to IgniteNode landing
    if (igniteAccess && !sparkAccess) return navigate('/ignitenode')
    // 3. SparkNode only (default) → go to SparkNode dashboard
    navigate('/dashboard')
  }

  // ── Request OTP mutation ──────────────────────────────────────────────────
  const requestOtpMutation = useMutation({
    // tenant is resolved server-side from the X-Tenant-Slug / X-Tenant-ID header
    mutationFn: () => authAPI.requestEmailOtp(email.trim().toLowerCase()),
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
    mutationFn: () => authAPI.verifyEmailOtp(email.trim().toLowerCase(), otp.trim()),
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

  // ── SMS OTP mutations ─────────────────────────────────────────────────────
  const requestSmsOtpMutation = useMutation({
    mutationFn: () => authAPI.requestSmsOtp(mobile.trim(), tenantId),
    onSuccess: () => {
      setStep('sms_otp')
      setSmsOtp('')
      setSmsTimer(60)
      toast.success('Verification code sent to your phone')
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to send SMS code')
    },
  })

  const verifySmsOtpMutation = useMutation({
    mutationFn: () => authAPI.verifySmsOtp(mobile.trim(), smsOtp.trim(), tenantId),
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

  const handleRequestSmsOtp = (e) => {
    e?.preventDefault()
    if (!mobile.trim()) return toast.error('Please enter your phone number')
    requestSmsOtpMutation.mutate()
  }

  const handleVerifySmsOtp = (e) => {
    e?.preventDefault()
    if (smsOtp.trim().length < 6) return toast.error('Enter the 6-digit code')
    verifySmsOtpMutation.mutate()
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

          {/* ── Step: password (default) ─────────────────────────────────────── */}
          {step === 'password' && (
            <div className="space-y-4">
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
                      autoFocus
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

              {/* Alternative sign-in options */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span>or sign in with</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border border-gray-200 hover:border-sparknode-purple/50 hover:bg-sparknode-purple/5 text-gray-600 hover:text-sparknode-purple transition-all text-xs font-medium"
                  >
                    <HiOutlineShieldCheck className="w-5 h-5" />
                    Email OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('sms')}
                    className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border border-gray-200 hover:border-sparknode-purple/50 hover:bg-sparknode-purple/5 text-gray-600 hover:text-sparknode-purple transition-all text-xs font-medium"
                  >
                    <HiOutlinePhone className="w-5 h-5" />
                    SMS OTP
                  </button>
                  <button
                    type="button"
                    onClick={handleSSOLogin}
                    className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border border-gray-200 hover:border-sparknode-purple/50 hover:bg-sparknode-purple/5 text-gray-600 hover:text-sparknode-purple transition-all text-xs font-medium"
                  >
                    <HiOutlineLibrary className="w-5 h-5" />
                    SSO
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step: email (enter email for OTP) ───────────────────────────── */}
          {step === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-sparknode-purple/10 rounded-full mb-3">
                  <HiOutlineMail className="w-6 h-6 text-sparknode-purple" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Sign in with Email OTP</h2>
                <p className="text-sm text-gray-500 mt-1">We'll send a verification code to your work email</p>
              </div>
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
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={requestOtpMutation.isPending}
                className="w-full btn-primary h-11 font-bold"
              >
                {requestOtpMutation.isPending ? 'Sending…' : 'Send Verification Code'}
              </button>
              <button
                type="button"
                onClick={() => setStep('password')}
                className="w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-800"
              >
                <HiOutlineArrowLeft className="w-3.5 h-3.5" />
                Back to password login
              </button>
            </form>
          )}

          {/* ── Step: otp (verify email OTP) ────────────────────────────────── */}
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

          {/* ── Step: sms (enter phone for SMS OTP) ─────────────────────────── */}
          {step === 'sms' && (
            <form onSubmit={handleRequestSmsOtp} className="space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-sparknode-purple/10 rounded-full mb-3">
                  <HiOutlinePhone className="w-6 h-6 text-sparknode-purple" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Sign in with SMS OTP</h2>
                <p className="text-sm text-gray-500 mt-1">We'll send a verification code to your mobile number</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <div className="relative">
                  <HiOutlinePhone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    className="input pl-10 h-11"
                    placeholder="+1 234 567 8900"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={requestSmsOtpMutation.isPending}
                className="w-full btn-primary h-11 font-bold"
              >
                {requestSmsOtpMutation.isPending ? 'Sending…' : 'Send SMS Code'}
              </button>
              <button
                type="button"
                onClick={() => setStep('password')}
                className="w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-800"
              >
                <HiOutlineArrowLeft className="w-3.5 h-3.5" />
                Back to password login
              </button>
            </form>
          )}

          {/* ── Step: sms_otp (verify SMS OTP) ──────────────────────────────── */}
          {step === 'sms_otp' && (
            <form onSubmit={handleVerifySmsOtp} className="space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-full mb-3">
                  <HiOutlineShieldCheck className="w-6 h-6 text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Check your messages</h2>
                <p className="text-sm text-gray-500 mt-1">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-gray-800">{mobile}</span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">Verification Code</label>
                <div className="relative">
                  <HiOutlineKey className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={smsOtp}
                    onChange={e => setSmsOtp(e.target.value.replace(/\D/g, ''))}
                    className="input pl-10 h-12 text-center tracking-[0.6em] text-xl font-bold"
                    placeholder="000000"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={verifySmsOtpMutation.isPending || smsOtp.length < 6}
                className="w-full btn-primary h-11 font-bold"
              >
                {verifySmsOtpMutation.isPending ? 'Verifying…' : 'Verify & Sign In'}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setStep('sms'); setSmsOtp('') }}
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-800"
                >
                  <HiOutlineArrowLeft className="w-3.5 h-3.5" />
                  Change number
                </button>
                {smsTimer > 0
                  ? <span className="text-gray-400">Resend in {smsTimer}s</span>
                  : (
                    <button
                      type="button"
                      onClick={handleRequestSmsOtp}
                      disabled={requestSmsOtpMutation.isPending}
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
