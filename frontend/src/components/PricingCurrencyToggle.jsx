import { usePricingCurrency } from '../contexts/PricingCurrencyContext'

const TOGGLES = [
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'INR', symbol: '₹', label: 'INR' },
]

export const PricingCurrencyToggle = () => {
  const { currency, setCurrency } = usePricingCurrency()

  return (
    <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-sm border border-slate-700 rounded-full px-3 py-1.5">
      <span className="text-xs font-medium text-slate-300 hidden md:block">
        Billing currency
      </span>
      {TOGGLES.map(({ code, symbol, label }) => (
        <button
          key={code}
          onClick={() => setCurrency(code)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${
            currency === code
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25 scale-105'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/50 border border-slate-600 hover:border-slate-500'
          }`}
        >
          {symbol} {label}
        </button>
      ))}
    </div>
  )
}
