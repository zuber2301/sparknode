/**
 * useCurrency — single source of truth for tenant currency formatting.
 *
 * Every component that needs to display a monetary/point value should use this
 * hook instead of reading tenantContext.display_currency directly.  This ensures
 * that when platform admin changes tenant currency the whole UI updates in one go.
 *
 * Usage:
 *   const { currency, fxRate, symbol, label, format } = useCurrency()
 *   <span>{format(wallet.balance)}</span>   // e.g. "₹8,312"
 */

import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { tenantsAPI } from '../lib/api'

// ── Static reference data ──────────────────────────────────────────────────────
export const CURRENCY_META = {
  USD: { symbol: '$',  locale: 'en-US',  decimals: 0 },
  INR: { symbol: '₹',  locale: 'en-IN',  decimals: 0 },
  EUR: { symbol: '€',  locale: 'de-DE',  decimals: 0 },
  GBP: { symbol: '£',  locale: 'en-GB',  decimals: 0 },
  JPY: { symbol: '¥',  locale: 'ja-JP',  decimals: 0 },
  AED: { symbol: 'د.إ', locale: 'ar-AE', decimals: 0 },
  SGD: { symbol: 'S$', locale: 'en-SG',  decimals: 0 },
  AUD: { symbol: 'A$', locale: 'en-AU',  decimals: 0 },
  CAD: { symbol: 'C$', locale: 'en-CA',  decimals: 0 },
}

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_META)

/** Return currency symbol for a code, e.g. currencySymbol('INR') → '₹' */
export function currencySymbol(code) {
  return CURRENCY_META[code]?.symbol ?? code
}

/**
 * Format a raw points value using a currency code and fx rate.
 *  - value    : raw points (stored as base units, 1:1 with points)
 *  - currency : ISO 4217 code
 *  - fxRate   : multiply points by fxRate to get display value (default 1)
 */
export function formatWithCurrency(value, currency = 'INR', fxRate = 1) {
  if (value === null || value === undefined || isNaN(value)) return '—'
  const meta = CURRENCY_META[currency] ?? CURRENCY_META['USD']
  const displayValue = Math.round(Number(value) * Number(fxRate))
  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: meta.decimals,
    minimumFractionDigits: meta.decimals,
  }).format(displayValue)
}

/**
 * useCurrency — the primary hook.
 *
 * Reads currency from tenantContext (populated by TopHeader on every page load).
 * Falls back to a fresh API call only when tenantContext is missing.
 */
export function useCurrency() {
  const { tenantContext } = useAuthStore()

  // Fallback query — only executes when context is missing currency data
  const { data: tenantData } = useQuery({
    queryKey: ['tenant', 'current', 'currency'],
    queryFn: () => tenantsAPI.getCurrent().then(r => r.data),
    enabled: !tenantContext?.display_currency,
    staleTime: 5 * 60 * 1000,
  })

  const currency  = tenantContext?.display_currency || tenantData?.display_currency || 'INR'
  const fxRate    = parseFloat(tenantContext?.fx_rate ?? tenantData?.fx_rate ?? 1) || 1
  const label     = tenantContext?.currency_label || tenantData?.currency_label || 'Points'
  const symbol    = currencySymbol(currency)

  /** Format a raw points value for display */
  function format(value, opts = {}) {
    const { pts = value, rate = fxRate, curr = currency } = opts
    return formatWithCurrency(pts, curr, rate)
  }

  /** Format without currency symbol — just the number */
  function formatNumber(value) {
    const meta = CURRENCY_META[currency] ?? CURRENCY_META['USD']
    const displayValue = Math.round(Number(value) * fxRate)
    return new Intl.NumberFormat(meta.locale, {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(displayValue)
  }

  return { currency, fxRate, symbol, label, format, formatNumber }
}

export default useCurrency
