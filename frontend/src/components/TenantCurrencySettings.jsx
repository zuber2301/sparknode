import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tenantsAPI, platformApi } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { TenantCurrencyFormatter, getCurrencyOptions, SUPPORTED_CURRENCIES } from '../lib/currency'
import toast from 'react-hot-toast'
import {
  HiOutlineCog,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineArrowRight,
  HiOutlineInformationCircle
} from 'react-icons/hi'

export default function TenantCurrencySettings({ tenantId = null }) {
  const [formData, setFormData] = useState({
    currency: 'USD',
    conversion_rate: 1.0
  })
  const [isEditing, setIsEditing] = useState(false)
  const [previewFormatter, setPreviewFormatter] = useState(null)
  const queryClient = useQueryClient()
  const { tenantContext } = useAuthStore()

  // Fetch tenant config. If a tenantId is provided (platform admin editing a tenant),
  // use the platform API; otherwise use the current tenant API.
  const { data: tenantData, isLoading } = useQuery({
    queryKey: tenantId ? ['platformTenant', tenantId] : ['tenant', 'current'],
    queryFn: () => {
      if (tenantId) return platformApi.getTenantById(tenantId).then(r => r.data)
      return tenantsAPI.getCurrent().then(r => r.data)
    },
    enabled: tenantId ? !!tenantId : true,
  })

  // Update tenant mutation
  const updateMutation = useMutation({
    mutationFn: (data) => {
      if (tenantId) return platformApi.updateTenant(tenantId, data)
      return tenantsAPI.updateCurrent(data)
    },
    onSuccess: (response) => {
      toast.success('Currency settings updated successfully!')
      queryClient.invalidateQueries(['tenant', 'current'])
      setIsEditing(false)
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error.message}`)
    }
  })

  // Initialize form with tenant data
  useEffect(() => {
    if (tenantData) {
      setFormData({
        currency: tenantData.display_currency || tenantData.currency || 'USD',
        conversion_rate: parseFloat(tenantData.fx_rate || tenantData.conversion_rate) || 1.0
      })
    }
  }, [tenantData])

  // Update preview when form changes
  useEffect(() => {
    if (formData.currency && formData.conversion_rate) {
      setPreviewFormatter(
        new TenantCurrencyFormatter(
          'USD',
          formData.currency,
          parseFloat(formData.conversion_rate)
        )
      )
    }
  }, [formData])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    
    if (name === 'conversion_rate') {
      // Validate: only allow positive numbers with up to 4 decimal places
      const regex = /^\d*\.?\d{0,4}$/
      if (regex.test(value) || value === '') {
        setFormData(prev => ({
          ...prev,
          [name]: value
        }))
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!formData.currency) {
      toast.error('Please select a currency')
      return
    }
    
    if (formData.currency !== 'USD' && (!formData.conversion_rate || parseFloat(formData.conversion_rate) <= 0)) {
      toast.error('Please enter a valid exchange rate (must be greater than 0)')
      return
    }

    const conversionRate = formData.currency === 'USD' ? 1.0 : parseFloat(formData.conversion_rate)
    
    updateMutation.mutate({
      display_currency: formData.currency,
      fx_rate: conversionRate
    })
  }

  const handleReset = () => {
    if (tenantData) {
      setFormData({
        currency: tenantData.currency || tenantData.display_currency || 'USD',
        conversion_rate: parseFloat(tenantData.conversion_rate || tenantData.fx_rate) || 1.0
      })
    }
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sparknode-purple"></div>
      </div>
    )
  }

  const currencyOptions = getCurrencyOptions()
  const preview = previewFormatter?.getLivePreview()

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HiOutlineCog className="w-6 h-6 text-sparknode-purple" />
          Currency Settings
        </h2>
        <p className="text-gray-600 mt-1">
          Configure multi-currency support for your organization
        </p>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        {/* Current Settings Display */}
        {!isEditing && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Current Currency</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {tenantData?.display_currency || 'USD'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Exchange Rate</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  1 USD = {tenantData?.conversion_rate || tenantData?.fx_rate || 1.0} {tenantData?.currency || tenantData?.display_currency || 'USD'}
                </p>
              </div>
            </div>

            {/* Current Example */}
            {tenantData && (
              <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200 flex gap-2">
                <HiOutlineInformationCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  <strong>Example:</strong> 100 base points = <strong>{new TenantCurrencyFormatter('USD', tenantData?.currency || tenantData?.display_currency, tenantData?.conversion_rate || tenantData?.fx_rate).formatBaseValue(100)}</strong>
                </p>
              </div>
            )}

            
          </div>
        )}

        {/* Edit Form */}
        {isEditing && (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Currency Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sparknode-purple focus:border-transparent"
              >
                {currencyOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the currency in which to display all values in your platform
              </p>
            </div>

            {/* FX Rate Input */}
            {formData.currency !== 'USD' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Conversion Rate
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-700 font-medium">1 USD =</span>
                  <input
                    type="number"
                    name="conversion_rate"
                    value={formData.conversion_rate}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.0001"
                    min="0.0001"
                    max="999999"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sparknode-purple focus:border-transparent"
                  />
                  <span className="text-gray-700 font-medium">{formData.currency}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter the exchange rate with up to 4 decimal places
                </p>
              </div>
            )}

            {/* Live Preview */}
            {preview && (
              <div className="p-4 bg-gradient-to-r from-sparknode-purple/10 to-sparknode-blue/10 rounded-lg border border-sparknode-purple/20">
                <p className="text-sm font-medium text-gray-700 mb-3">Live Preview</p>
                <div className="flex items-center gap-3 text-center">
                  <div className="flex-1">
                    <p className="text-xs text-gray-600">Base Value</p>
                    <p className="text-lg font-bold text-gray-900">{preview.baseAmount} Points</p>
                  </div>
                  <HiOutlineArrowRight className="w-5 h-5 text-sparknode-purple" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-600">Display Value</p>
                    <p className="text-lg font-bold text-sparknode-purple">{preview.formatted}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-sparknode-purple text-white rounded-lg hover:bg-sparknode-purple/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updateMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <HiOutlineCheckCircle className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Information Box */}
      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
        <div className="flex gap-3">
          <HiOutlineExclamationCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">Important:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>All values are stored in USD internally</li>
              <li>Display currency only affects UI formatting</li>
              <li>Exchange rates should be kept up to date for accuracy</li>
              <li>Changes apply immediately across the platform</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Supported Currencies Reference */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3">Supported Currencies</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(SUPPORTED_CURRENCIES).map(([key, code]) => (
            <div key={code} className="text-sm">
              <p className="font-medium text-gray-900">{code}</p>
              <p className="text-xs text-gray-600">{key}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
