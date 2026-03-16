/**
 * Pricing — plan comparison page
 *
 * Core   → Employee Engagement (recognition, rewards, events)
 * Growth → Core + Growth Events (campaigns, leads, ROI)
 *
 * Accessible without login at /pricing.
 * Currency (USD/INR) persisted in localStorage via PricingCurrencyContext.
 */

import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { HiOutlineCheckCircle, HiOutlineXCircle } from 'react-icons/hi'
import { PricingCurrencyProvider } from '../contexts/PricingCurrencyContext'
import { PricingCurrencyToggle } from '../components/PricingCurrencyToggle'
import { PricingPlans } from '../components/PricingPlans'

// ─── Feature matrix ───────────────────────────────────────────────────────────

const FEATURE_SECTIONS = [
  {
    title: 'Employee Engagement',
    features: [
      { name: 'Peer recognition & kudos',         core: true,   growth: true  },
      { name: 'Points wallet & ledger',            core: true,   growth: true  },
      { name: 'Rewards catalog & redemption',      core: true,   growth: true  },
      { name: 'Company values & culture feed',     core: true,   growth: true  },
      { name: 'Challenges & leaderboards',         core: true,   growth: true  },
      { name: 'Company events hub',                core: true,   growth: true  },
      { name: 'Team analytics & insights',         core: true,   growth: true  },
      { name: 'Department budget management',      core: true,   growth: true  },
      { name: 'Multi-currency support',            core: true,   growth: true  },
    ],
  },
  {
    title: 'Growth Events',
    badge: 'Growth',
    features: [
      { name: 'Sales campaign management',         core: false,  growth: true  },
      { name: 'Lead-gen & webinar events',         core: false,  growth: true  },
      { name: 'Leads dashboard & funnel',          core: false,  growth: true  },
      { name: 'Event ROI & attribution reports',   core: false,  growth: true  },
      { name: 'Escrow budget approval',            core: false,  growth: true  },
      { name: 'Sales leaderboard',                 core: false,  growth: true  },
    ],
  },
  {
    title: 'Platform & Security',
    features: [
      { name: 'Multi-tenant architecture',         core: true,   growth: true  },
      { name: 'Role-based access control',         core: true,   growth: true  },
      { name: 'Audit log',                         core: true,   growth: true  },
      { name: 'API access',                        core: false,  growth: true  },
      { name: 'Priority support + onboarding',     core: false,  growth: true  },
      { name: 'SSO / SAML',                        core: false,  growth: 'Add-on' },
      { name: 'Dedicated infrastructure',          core: false,  growth: 'Enterprise' },
    ],
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function Check({ value }) {
  if (value === true)  return <HiOutlineCheckCircle className="w-5 h-5 text-green-400 mx-auto" />
  if (value === false) return <HiOutlineXCircle className="w-5 h-5 text-slate-600 mx-auto" />
  return <span className="text-xs text-slate-400 text-center block">{value}</span>
}

// ─── Main Pricing page ────────────────────────────────────────────────────────

export default function Pricing() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  return (
    <PricingCurrencyProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Nav */}
        <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">SN</span>
            </div>
            <span className="text-lg font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              SparkNode
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <button
                onClick={() => navigate(-1)}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
            ) : (
              <>
                <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                  Get started free
                </Link>
              </>
            )}
          </div>
        </nav>

        <div className="max-w-6xl mx-auto px-4 py-16">
          {/* Hero */}
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full mb-4">
              Pricing
            </span>
            <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
              Simple, powerful pricing
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-8">
              Start with Employee Engagement. Add Growth Events when you're ready to scale.
              No per-feature bolt-ons — just two clean tiers.
            </p>
            <div className="flex justify-center">
              <PricingCurrencyToggle />
            </div>
          </div>

          {/* Plan cards */}
          <div className="mb-10">
            <PricingPlans />
          </div>

          {/* Annual billing note */}
          <div className="max-w-4xl mx-auto mb-20">
            <div className="p-5 bg-slate-900/50 border border-slate-700 rounded-2xl text-center">
              <p className="text-slate-300 text-sm">
                <span className="font-semibold text-white">Annual billing:</span>{' '}
                Save 20% with a yearly commitment.{' '}
                <a
                  href="mailto:sales@sparknode.io"
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                >
                  Contact sales →
                </a>
              </p>
            </div>
          </div>

          {/* Feature comparison table */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden mb-16">
            {/* Sticky table header */}
            <div className="sticky top-0 z-10 grid grid-cols-3 bg-slate-900 border-b border-slate-700">
              <div className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                Feature
              </div>
              <div className="px-4 py-4 text-center">
                <p className="text-sm font-black text-slate-200">Core</p>
              </div>
              <div className="px-4 py-4 text-center">
                <p className="text-sm font-black text-purple-400">Growth</p>
              </div>
            </div>

            {FEATURE_SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="flex items-center gap-3 px-6 py-3 bg-slate-800/50 border-b border-slate-700/50">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {section.title}
                  </span>
                  {section.badge && (
                    <span className="text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">
                      {section.badge}
                    </span>
                  )}
                </div>
                {section.features.map((feat, i) => (
                  <div
                    key={feat.name}
                    className={`grid grid-cols-3 border-b border-slate-800 last:border-0 ${i % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/20'}`}
                  >
                    <div className="px-6 py-3.5 text-sm text-slate-300">{feat.name}</div>
                    <div className="px-4 py-3.5 text-center"><Check value={feat.core} /></div>
                    <div className="px-4 py-3.5 text-center"><Check value={feat.growth} /></div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* FAQ strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {[
              {
                q: 'Can I switch plans?',
                a: 'Yes. Upgrade or downgrade any time from your Settings page. Downgrade takes effect at the next billing cycle.',
              },
              {
                q: 'What counts as a team?',
                a: 'Active users in your tenant during the billing month. Invited but never logged-in users are not counted.',
              },
              {
                q: 'Is there a free trial?',
                a: 'Every new tenant gets a 30-day Growth trial automatically. No credit card required.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="bg-slate-900/50 rounded-xl border border-slate-700 p-6">
                <h3 className="font-bold text-white mb-2">{q}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>

          {/* CTA banner */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-2xl px-8 py-10 text-center text-white">
            <h2 className="text-3xl font-black mb-3">Ready to spark your team?</h2>
            <p className="text-white/80 mb-6 text-lg">
              30-day Growth trial, no credit card. Set up in under 5 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signup"
                className="bg-white text-purple-700 font-bold px-8 py-3 rounded-xl hover:bg-purple-50 transition-colors"
              >
                Start free trial
              </Link>
              <a
                href="mailto:sales@sparknode.io"
                className="border-2 border-white/40 text-white font-bold px-8 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                Talk to sales
              </a>
            </div>
          </div>
        </div>
      </div>
    </PricingCurrencyProvider>
  )
}
