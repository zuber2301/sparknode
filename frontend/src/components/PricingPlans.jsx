import { usePricingCurrency } from '../contexts/PricingCurrencyContext'
import { PLAN_TIERS, SYMBOLS } from '../lib/pricing'

const PLANS = [
  {
    id: 'core',
    name: 'Core',
    tagline: 'Employee Engagement',
    highlight: false,
    features: [
      'Unlimited recognition & e-cards',
      'Points wallet & redemption',
      'Company events (Annual Day, Sports Day)',
      'Social feed & notifications',
      'Basic analytics',
      'Email support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'Employee Engagement + Growth Events',
    highlight: true,
    features: [
      'Everything in Core',
      'Sales campaigns & webinars',
      'Lead capture & export',
      'Partner events & ROI tracking',
      'Advanced reporting & attribution',
      'Priority support + onboarding',
    ],
  },
]

export const PricingPlans = () => {
  const { currency } = usePricingCurrency()
  const prices = PLAN_TIERS[currency]
  const symbol = SYMBOLS[currency]

  const formatPrice = (value) => {
    const locale = currency === 'INR' ? 'en-IN' : 'en-US'
    return new Intl.NumberFormat(locale).format(value)
  }

  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className={`group relative rounded-3xl border-2 p-8 bg-slate-900/50 backdrop-blur-xl transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1 ${
            plan.highlight
              ? 'border-blue-500/50 shadow-lg shadow-blue-500/25 scale-[1.02]'
              : 'border-slate-700/50'
          }`}
        >
          {plan.highlight && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-500 px-4 py-1 rounded-full text-xs font-bold text-white shadow-lg whitespace-nowrap">
              Most Popular
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-1">{plan.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{plan.tagline}</p>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl md:text-5xl font-black text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text">
                {symbol}{formatPrice(prices[plan.id])}
              </span>
              <span className="text-sm text-slate-400">/month</span>
            </div>
          </div>

          <ul className="space-y-2 mb-8">
            {plan.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                <span className="text-green-400 text-base mt-0.5 shrink-0">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          <button
            className={`w-full py-3 px-6 rounded-2xl font-semibold text-base transition-all duration-200 ${
              plan.highlight
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02]'
                : 'bg-slate-700/50 border-2 border-slate-600 text-slate-200 hover:bg-slate-600 hover:border-slate-500'
            }`}
          >
            {plan.highlight ? 'Get Started — Most Popular' : 'Get Started'}
          </button>
        </div>
      ))}
    </div>
  )
}
