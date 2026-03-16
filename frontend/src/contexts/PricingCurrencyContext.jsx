import { createContext, useContext, useState, useEffect } from 'react'

const PricingCurrencyContext = createContext(null)

export const PricingCurrencyProvider = ({ children }) => {
  const [currency, setCurrencyState] = useState('USD')

  useEffect(() => {
    const stored = localStorage.getItem('pricing_currency')
    if (stored) setCurrencyState(stored)
  }, [])

  const setCurrency = (c) => {
    setCurrencyState(c)
    localStorage.setItem('pricing_currency', c)
  }

  return (
    <PricingCurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </PricingCurrencyContext.Provider>
  )
}

export const usePricingCurrency = () => {
  const ctx = useContext(PricingCurrencyContext)
  if (!ctx) throw new Error('usePricingCurrency must be within PricingCurrencyProvider')
  return ctx
}
