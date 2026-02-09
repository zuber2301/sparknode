import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  HiOutlineX, 
  HiOutlineCheckCircle, 
  HiOutlineTicket, 
  HiOutlineTruck, 
  HiOutlineShieldCheck,
  HiOutlineMail,
  HiOutlineClipboardCopy
} from 'react-icons/hi'
import { redemptionAPI } from '../lib/api'
import toast from 'react-hot-toast'

export default function RedemptionFlow({ voucher, isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('summary') // summary, otp, delivery, success, loading
  const [redemption, setRedemption] = useState(null)
  const [otp, setOtp] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deliveryData, setDeliveryData] = useState({
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India'
  })

  // Reset state when closed/opened
  useEffect(() => {
    if (isOpen) {
      setStep('summary')
      setRedemption(null)
      setOtp('')
      setIsSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen || !voucher) return null

  const handleInitiate = async () => {
    setIsSubmitting(true)
    try {
      const resp = await redemptionAPI.initiate({ voucher_id: voucher.id })
      setRedemption(resp.data)
      setStep('otp')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initiate redemption')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (otp.length < 6) {
      toast.error('Please enter the 6-digit code')
      return
    }
    setIsSubmitting(true)
    try {
      const resp = await redemptionAPI.verifyOTP({ 
        redemption_id: redemption.id,
        otp: otp
      })
      setRedemption(resp.data)
      
      if (resp.data.reward_type === 'merchandise' && resp.data.status !== 'completed') {
        setStep('delivery')
      } else {
        setStep('success')
        onSuccess?.()
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid verification code')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeliveryDetails = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const resp = await redemptionAPI.deliveryDetails({
        redemption_id: redemption.id,
        ...deliveryData
      })
      setRedemption(resp.data)
      setStep('success')
      onSuccess?.()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save delivery details')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendOTP = async () => {
    try {
      await redemptionAPI.resendOTP(redemption.id)
      toast.success('Verification code resent')
    } catch (error) {
      toast.error('Failed to resend code')
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const ModalHeader = ({ title, showBack = false }) => (
    <div className="flex items-center justify-between p-6 border-b border-gray-100">
      <div className="flex items-center gap-3">
        {showBack && (
          <button 
            onClick={() => setStep('summary')}
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            ←
          </button>
        )}
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
      </div>
      <button 
        onClick={onClose}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
      >
        <HiOutlineX className="w-5 h-5 text-gray-500" />
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {step === 'summary' && (
            <motion.div 
              key="summary"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
            >
              <ModalHeader title="Confirm Redemption" />
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-2xl">
                  <img 
                    src={voucher.brand_logo || voucher.image_url} 
                    alt={voucher.brand_name}
                    className="w-20 h-20 rounded-xl object-contain bg-white shadow-sm"
                  />
                  <div>
                    <h4 className="font-bold text-gray-900 text-lg">{voucher.name}</h4>
                    <p className="text-gray-500">{voucher.brand_name}</p>
                    <div className="flex items-center gap-2 mt-2 text-sparknode-purple font-semibold">
                      <HiOutlineTicket className="w-5 h-5" />
                      <span>{voucher.points_required} Points</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3">
                  <HiOutlineShieldCheck className="w-6 h-6 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-amber-900 font-medium text-sm">Security Verification</p>
                    <p className="text-amber-700 text-sm mt-1">
                      We'll send a 6-digit verification code to your registered email to complete this transaction.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleInitiate}
                    disabled={isSubmitting}
                    className="w-full py-4 bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white font-bold rounded-2xl hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Processing...' : 'Proceed to Redeem'}
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full py-4 text-gray-500 font-medium hover:text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'otp' && (
            <motion.div 
              key="otp"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
            >
              <ModalHeader title="Verify Identity" />
              <div className="p-8 text-center space-y-6">
                <div className="mx-auto w-20 h-20 bg-sparknode-purple/10 rounded-full flex items-center justify-center">
                  <HiOutlineMail className="w-10 h-10 text-sparknode-purple" />
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-gray-900">Enter Verification Code</h4>
                  <p className="text-gray-500 px-4">
                    Please enter the code sent to your email. Check your spam folder if you haven't received it.
                  </p>
                </div>

                <div className="flex justify-center">
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-48 text-center text-4xl font-bold tracking-[0.5em] py-4 border-b-2 border-sparknode-purple focus:outline-none bg-transparent"
                    placeholder="000000"
                  />
                </div>

                <div className="space-y-4 pt-4">
                  <button
                    onClick={handleVerifyOTP}
                    disabled={isSubmitting || otp.length < 6}
                    className="w-full py-4 bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white font-bold rounded-2xl hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify & Complete'}
                  </button>
                  <p className="text-sm text-gray-500">
                    Didn't receive the code?{' '}
                    <button 
                      onClick={handleResendOTP}
                      className="text-sparknode-purple font-bold hover:underline"
                    >
                      Resend Code
                    </button>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'delivery' && (
            <motion.div 
              key="delivery"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
            >
              <ModalHeader title="Delivery Details" />
              <form onSubmit={handleDeliveryDetails} className="p-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Full Name</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-sparknode-purple/20 focus:border-sparknode-purple outline-none transition-all"
                      value={deliveryData.full_name}
                      onChange={e => setDeliveryData({...deliveryData, full_name: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Phone Number</label>
                    <input
                      required
                      type="tel"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-sparknode-purple/20 focus:border-sparknode-purple outline-none transition-all"
                      value={deliveryData.phone}
                      onChange={e => setDeliveryData({...deliveryData, phone: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Address Line 1</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-sparknode-purple/20 focus:border-sparknode-purple outline-none transition-all"
                      value={deliveryData.address_line1}
                      onChange={e => setDeliveryData({...deliveryData, address_line1: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">City</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-sparknode-purple/20 focus:border-sparknode-purple outline-none transition-all"
                      value={deliveryData.city}
                      onChange={e => setDeliveryData({...deliveryData, city: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Postal Code</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-sparknode-purple/20 focus:border-sparknode-purple outline-none transition-all"
                      value={deliveryData.postal_code}
                      onChange={e => setDeliveryData({...deliveryData, postal_code: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-gradient-to-r from-sparknode-purple to-sparknode-blue text-white font-bold rounded-2xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <HiOutlineTruck className="w-6 h-6" />
                    {isSubmitting ? 'Saving...' : 'Submit Delivery Details'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div 
              key="success"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-8 text-center space-y-6"
            >
              <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                <HiOutlineCheckCircle className="w-16 h-16 text-green-500" />
              </div>
              
              <div className="space-y-2">
                <h4 className="text-2xl font-bold text-gray-900">Redemption Successful!</h4>
                <p className="text-gray-500">
                  Your {voucher.name} has been processed.
                </p>
              </div>

              {redemption?.voucher_code && (
                <div className="p-6 bg-sparknode-purple/5 rounded-3xl border border-sparknode-purple/10 space-y-4">
                  <p className="text-xs font-bold text-sparknode-purple uppercase tracking-[0.2em]">Your Voucher Code</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-3xl font-mono font-bold text-gray-900 tracking-wider">
                      {redemption.voucher_code}
                    </span>
                    <button 
                      onClick={() => copyToClipboard(redemption.voucher_code)}
                      className="p-2 hover:bg-white rounded-xl transition-colors text-sparknode-purple"
                    >
                      <HiOutlineClipboardCopy className="w-6 h-6" />
                    </button>
                  </div>
                  {redemption.voucher_pin && (
                    <p className="text-sm text-gray-500">PIN: <span className="font-bold">{redemption.voucher_pin}</span></p>
                  )}
                </div>
              )}

              {redemption?.reward_type === 'merchandise' && (
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-800 text-sm">
                  Our team will process your delivery soon. You can track progress in your redemption history.
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all"
                >
                  Close & Go Back
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
