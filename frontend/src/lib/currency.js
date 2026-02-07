/**
 * Currency conversion and formatting utilities for the frontend.
 * Provides consistent currency formatting across all components.
 * Supports USD, INR, EUR, GBP, JPY
 */

/**
 * Supported currencies in the system
 */
export const SUPPORTED_CURRENCIES = {
  USD: 'USD',
  INR: 'INR',
  EUR: 'EUR',
  GBP: 'GBP',
  JPY: 'JPY'
}

/**
 * Currency symbols for display
 */
export const CURRENCY_SYMBOLS = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  JPY: '¥'
}

/**
 * Locale mappings for Intl.NumberFormat
 */
export const CURRENCY_LOCALES = {
  USD: 'en-US',
  INR: 'en-IN',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP'
}

/**
 * Decimal places for each currency
 */
export const DECIMAL_PLACES = {
  USD: 2,
  INR: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0 // JPY doesn't use decimals
}

/**
 * Convert a base value (in USD) to display currency using the FX rate.
 * 
 * @param {number} baseValue - The value in base currency (typically USD)
 * @param {number} fxRate - The exchange rate (e.g., 1 USD = 83.12 INR means fxRate=83.12)
 * @returns {number} The converted value
 * 
 * @example
 * convertToDisplayCurrency(100, 83.12) // Returns 8312
 */
export const convertToDisplayCurrency = (baseValue, fxRate = 1) => {
  if (!fxRate || fxRate <= 0) {
    console.warn('Invalid FX rate provided:', fxRate)
    fxRate = 1
  }
  const converted = baseValue * fxRate
  return Math.round(converted * 100) / 100 // Ensure 2 decimal precision
}

/**
 * Convert a display currency value back to base currency (USD).
 * 
 * @param {number} displayValue - The value in display currency
 * @param {number} fxRate - The exchange rate
 * @returns {number} The value in base currency
 * 
 * @example
 * convertFromDisplayCurrency(8312, 83.12) // Returns 100
 */
export const convertFromDisplayCurrency = (displayValue, fxRate = 1) => {
  if (!fxRate || fxRate <= 0) {
    console.warn('Invalid FX rate provided:', fxRate)
    fxRate = 1
  }
  const converted = displayValue / fxRate
  return Math.round(converted * 100) / 100
}

/**
 * Format a numeric value as currency with proper formatting and symbol.
 * This is the main utility function used across the app for currency display.
 * 
 * @param {number} baseValue - The value in base currency (USD)
 * @param {string} displayCurrency - The currency to display in (e.g., 'INR', 'USD')
 * @param {number} fxRate - The exchange rate (default: 1)
 * @returns {string} Formatted currency string with symbol
 * 
 * @example
 * formatCurrency(100, 'INR', 83.12) // Returns "₹8,312.00"
 * formatCurrency(100, 'USD') // Returns "$100.00"
 */
export const formatCurrency = (baseValue, displayCurrency = 'USD', fxRate = 1) => {
  try {
    // Convert to display currency
    const displayValue = convertToDisplayCurrency(baseValue, fxRate)
    
    // Get decimal places for this currency
    const decimals = DECIMAL_PLACES[displayCurrency] ?? 2
    
    // Use Intl.NumberFormat for locale-aware formatting
    const formatter = new Intl.NumberFormat(
      CURRENCY_LOCALES[displayCurrency] ?? 'en-US',
      {
        style: 'currency',
        currency: displayCurrency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }
    )
    
    return formatter.format(displayValue)
  } catch (error) {
    console.error('Currency formatting error:', error)
    // Fallback formatting
    const symbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency
    const displayValue = convertToDisplayCurrency(baseValue, fxRate)
    const decimals = DECIMAL_PLACES[displayCurrency] ?? 2
    return `${symbol}${displayValue.toFixed(decimals)}`
  }
}

/**
 * Format a value that's already in display currency (useful for prices already converted).
 * 
 * @param {number} displayValue - The value in display currency
 * @param {string} currencyCode - The currency code
 * @returns {string} Formatted currency string
 * 
 * @example
 * formatDisplayValue(8312, 'INR') // Returns "₹8,312.00"
 */
export const formatDisplayValue = (displayValue, currencyCode = 'USD') => {
  try {
    const decimals = DECIMAL_PLACES[currencyCode] ?? 2
    const formatter = new Intl.NumberFormat(
      CURRENCY_LOCALES[currencyCode] ?? 'en-US',
      {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }
    )
    
    return formatter.format(displayValue)
  } catch (error) {
    console.error('Currency formatting error:', error)
    const symbol = CURRENCY_SYMBOLS[currencyCode] ?? currencyCode
    const decimals = DECIMAL_PLACES[currencyCode] ?? 2
    return `${symbol}${displayValue.toFixed(decimals)}`
  }
}

/**
 * Format a number as compact currency (e.g., $1.5K, ₹2L) - LEGACY FUNCTION
 * @param {number|string} amount - The amount to format
 * @returns {string} Compact formatted currency string
 */
export function formatCurrencyCompact(amount) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (isNaN(numAmount)) {
    return `₹0`
  }

  if (numAmount >= 10000000) {
    return `₹${(numAmount / 10000000).toFixed(1)}Cr`
  } else if (numAmount >= 100000) {
    return `₹${(numAmount / 100000).toFixed(1)}L`
  } else if (numAmount >= 1000) {
    return `₹${(numAmount / 1000).toFixed(1)}K`
  }
  
  return formatCurrency(numAmount, 'INR')
}

/**
 * Format a points value for display using the Rupee symbol and no decimals.
 * Ensures integer display with locale-aware grouping (en-IN).
 * @param {number|string} amount
 * @returns {string}
 */
export function formatPoints(amount) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(numAmount)) return `₹0`
  const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
  return `₹${formatter.format(Math.round(numAmount))}`
}

/**
 * Get currency information (symbol, locale, decimal places).
 * 
 * @param {string} currencyCode - The currency code
 * @returns {object} Currency information object
 */
export const getCurrencyInfo = (currencyCode) => {
  if (!SUPPORTED_CURRENCIES[currencyCode]) {
    console.warn(`Unsupported currency: ${currencyCode}`)
    return getCurrencyInfo('USD')
  }
  
  return {
    code: currencyCode,
    symbol: CURRENCY_SYMBOLS[currencyCode],
    locale: CURRENCY_LOCALES[currencyCode],
    decimalPlaces: DECIMAL_PLACES[currencyCode]
  }
}

/**
 * Tenant currency context helper for consistent currency operations.
 * Use this when you have tenant-specific currency configuration.
 */
export class TenantCurrencyFormatter {
  constructor(baseCurrency = 'USD', displayCurrency = 'USD', fxRate = 1) {
    this.baseCurrency = baseCurrency
    this.displayCurrency = displayCurrency
    this.fxRate = fxRate || 1
  }

  /**
   * Format a base value for display
   */
  formatBaseValue(baseValue) {
    return formatCurrency(baseValue, this.displayCurrency, this.fxRate)
  }

  /**
   * Get exchange rate information
   */
  getExchangeInfo() {
    return {
      baseCurrency: this.baseCurrency,
      displayCurrency: this.displayCurrency,
      fxRate: this.fxRate,
      example: {
        input: 100,
        output: this.formatBaseValue(100)
      }
    }
  }

  /**
   * Create a live preview example for settings UI
   */
  getLivePreview() {
    const baseAmount = 100
    const displayAmount = convertToDisplayCurrency(baseAmount, this.fxRate)
    return {
      baseAmount,
      baseCurrency: this.baseCurrency,
      displayAmount,
      displayCurrency: this.displayCurrency,
      formatted: this.formatBaseValue(baseAmount),
      previewText: `Example: ${baseAmount} Points = ${this.formatBaseValue(baseAmount)}`
    }
  }
}

/**
 * Get a currency selector options for dropdowns
 */
export const getCurrencyOptions = () => {
  return Object.entries(SUPPORTED_CURRENCIES).map(([key, value]) => ({
    value,
    label: `${value} - ${CURRENCY_SYMBOLS[value]}`
  }))
}

export default {
  SUPPORTED_CURRENCIES,
  CURRENCY_SYMBOLS,
  CURRENCY_LOCALES,
  DECIMAL_PLACES,
  convertToDisplayCurrency,
  convertFromDisplayCurrency,
  formatCurrency,
  formatDisplayValue,
  getCurrencyInfo,
  getCurrencyOptions,
  TenantCurrencyFormatter,
  formatCurrencyCompact
}


// Provide backward-compatible named exports for other modules
export const CURRENCY_SYMBOL = CURRENCY_SYMBOLS
export const LOCALE = CURRENCY_LOCALES
