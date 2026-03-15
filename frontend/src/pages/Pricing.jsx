/**
 * Pricing — plan comparison page
 *
 * Core  → Employee Engagement (recognition, rewards, events)
 * Pro   → Core + Growth Events (campaigns, leads, ROI)
 *
 * Accessible without login at /pricing.
 * "Current plan" badge auto-detected from auth store.
 */

import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineLightningBolt,
  HiOutlineSparkles,
  HiOutlineShieldCheck,
  HiOutlineMail,
} from 'react-icons/hi'

// ─── Plan data ────────────────────────────────────────────────────────────────

const PLANS = [
  {
    key: 'core',
    name: 'Core',
    tagline: 'Employee Engagement',
    price: 10,
    unit: 'employee / mo',
    highlight: false,
    cta: 'Get started',
    ctaHref: '/signup',
    color: 'gray',
    icon: HiOutlineSparkles,
    description:
      'Everything you need to build a culture of recognition and keep employees engaged.',
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'Engagement + Growth',
    price: 15,
    unit: 'employee / mo',
    highlight: true,
    cta: 'Upgrade to Pro',
    ctaHref: '/settings',
    color: 'purple',
    icon: HiOutlineLightningBolt,
    description:
      'Add sales campaign management, leads tracking, and event ROI on top of Core.',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'Custom scale',
    price: null,
    unit: 'custom pricing',
    highlight: false,
    cta: 'Contact sales',
    ctaHref: 'mailto:sales@sparknode.io',
    color: 'indigo',
    icon: HiOutlineShieldCheck,
    description:
      'Dedicated infra, SLA, SSO, and volume pricing for 500+ employee organisations.',
  },
]

// ─── Feature matrix ───────────────────────────────────────────────────────────

const FEATURE_SECTIONS = [
  {
    title: 'Employee Engagement',
    features: [
      { name: 'Peer recognition & kudos',         core: true,   pro: true,   enterprise: true },
      { name: 'Points wallet & ledger',            core: true,   pro: true,   enterprise: true },
      { name: 'Rewards catalog & redemption',      core: true,   pro: true,   enterprise: true },
      { name: 'Company values & culture feed',     core: true,   pro: true,   enterprise: true },
      { name: 'Challenges & leaderboards',         core: true,   pro: true,   enterprise: true },
      { name: 'Company events hub',                core: true,   pro: true,   enterprise: true },
      { name: 'Team analytics & insights',         core: true,   pro: true,   enterprise: true },
      { name: 'Department budget management',      core: true,   pro: true,   enterprise: true },
      { name: 'Multi-currency support',            core: true,   pro: true,   enterprise: true },
    ],
  },
  {
    title: 'Growth Events',
    badge: 'Pro',
    features: [
      { name: 'Sales campaign management',         core: false,  pro: true,   enterprise: true },
      { name: 'Lead-gen & webinar events',         core: false,  pro: true,   enterprise: true },
      { name: 'Leads dashboard & funnel',          core: false,  pro: true,   enterprise: true },
      { name: 'Event ROI & attribution reports',   core: false,  pro: true,   enterprise: true },
      { name: 'Escrow budget approval',            core: false,  pro: true,   enterprise: true },
      { name: 'Sales leaderboard',                 core: false,  pro: true,   enterprise: true },
    ],
  },
  {
    title: 'Platform & Security',
    features: [
      { name: 'Multi-tenant architecture',         core: true,   pro: true,   enterprise: true },
      { name: 'Role-based access control',         core: true,   pro: true,   enterprise: true },
      { name: 'Audit log',                         core: true,   pro: true,   enterprise: true },
      { name: 'API access',                        core: false,  pro: true,   enterprise: true },
      { name: 'SSO / SAML',                        core: false,  pro: false,  enterprise: true },
      { name: 'Dedicated infrastructure',          core: false,  pro: false,  enterprise: true },
      { name: 'Custom SLA (99.99% uptime)',         core: false,  pro: false,  enterprise: true },
      { name: 'Onboarding & success manager',      core: false,  pro: false,  enterprise: true },
    ],
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function Check({ value }) {
  if (value === true) return <HiOutlineCheckCircle className="w-5 h-5 text-green-500 mx-auto" />
  if (value === false) return <HiOutlineXCircle className="w-5 h-5 text-gray-300 mx-auto" />
  return <span className="text-sm text-gray-500 text-center block">{value}</span>
}

function PlanCard({ plan, currentPlan }) {
  const isCurrent = plan.key === currentPlan
  const colorMap = {
    gray:   { border: 'border-gray-200',    btn: 'bg-gray-800 hover:bg-gray-900 text-white',          header: 'bg-gray-50',         badge: 'bg-gray-200 text-gray-700' },
    purple: { border: 'border-sparknode-purple ring-2 ring-sparknode-purple shadow-purple-100', btn: 'bg-sparknode-purple hover:bg-purple-700 text-white', header: 'bg-gradient-to-br from-sparknode-purple to-purple-700', badge: 'bg-purple-100 text-sparknode-purple' },
    indigo: { border: 'border-indigo-200',  btn: 'bg-indigo-600 hover:bg-indigo-700 text-white',      header: 'bg-indigo-50',       badge: 'bg-indigo-100 text-indigo-700' },
  }
  const c = colorMap[plan.color]
  const Icon = plan.icon
  const isExternal = plan.ctaHref.startsWith('mailto:')

  return (
    <div className={`relative flex flex-col rounded-2xl border-2 shadow-lg overflow-hidden ${c.border}`}>
      {plan.highlight && (
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sparknode-purple to-purple-400" />
      )}
      {isCurrent && (
        <div className="absolute top-4 right-4 z-10">
          <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
            Current plan
          </span>
        </div>
      )}

      {/* Header */}
      <div className={`px-6 pt-8 pb-6 ${plan.highlight ? 'bg-gradient-to-br from-sparknode-purple to-purple-700 text-white' : 'bg-white'}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${plan.highlight ? 'bg-white/20' : 'bg-purple-100'}`}>
          <Icon className={`w-5 h-5 ${plan.highlight ? 'text-white' : 'text-sparknode-purple'}`} />
        </div>
        <div className="flex items-baseline gap-1 mb-1">
          {plan.price !== null ? (
            <>
              <span className="text-4xl font-black">${plan.price}</span>
              <span className={`text-sm ${plan.highlight ? 'text-white/70' : 'text-gray-500'}`}>{plan.unit}</span>
            </>
          ) : (
            <span className="text-3xl font-black">Custom</span>
          )}
        </div>
        <p className={`text-xs mb-3 ${plan.highlight ? 'text-white/60' : 'text-gray-400'}`}>
          {plan.tagline}
        </p>
        <h3 className={`text-xl font-black mb-2 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
          {plan.name}
        </h3>
        <p className={`text-sm leading-relaxed ${plan.highlight ? 'text-white/80' : 'text-gray-500'}`}>
          {plan.description}
        </p>
      </div>

      {/* CTA */}
      <div className="px-6 py-4 border-t border-gray-100">
        {isExternal ? (
          <a
            href={plan.ctaHref}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${c.btn}`}
          >
            <HiOutlineMail className="w-4 h-4" />
            {plan.cta}
          </a>
        ) : isCurrent ? (
          <div className="w-full py-3 rounded-xl text-center text-sm font-bold bg-green-50 text-green-700 border border-green-200">
            ✓ Your current plan
          </div>
        ) : (
          <Link
            to={plan.ctaHref}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${c.btn}`}
          >
            {plan.cta}
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Main Pricing page ────────────────────────────────────────────────────────

export default function Pricing() {
  const navigate = useNavigate()
  const { isAuthenticated, tenantContext, user } = useAuthStore()

  const currentPlan =
    tenantContext?.subscription_tier || user?.subscription_tier || null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-sm">SN</span>
          </div>
          <span className="text-lg font-black bg-gradient-to-r from-sparknode-purple to-sparknode-blue bg-clip-text text-transparent">
            SparkNode
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              ← Back
            </button>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
                Sign in
              </Link>
              <Link
                to="/signup"
                className="text-sm bg-sparknode-purple text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
              >
                Get started free
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <span className="inline-block text-xs font-bold text-sparknode-purple uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-full mb-4">
            Pricing
          </span>
          <h1 className="text-5xl font-black text-gray-900 mb-4">
            One platform, two experiences
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Start with Employee Engagement. Add Growth Events when you're ready to scale.
            No per-feature bolt-ons — just two clean tiers.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {PLANS.map((plan) => (
            <PlanCard key={plan.key} plan={plan} currentPlan={currentPlan} />
          ))}
        </div>

        {/* Feature comparison table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-16">
          {/* Table header */}
          <div className="grid grid-cols-4 gap-0 bg-gray-50 border-b border-gray-200">
            <div className="px-6 py-4 text-sm font-bold text-gray-500 uppercase tracking-wide col-span-1">
              Feature
            </div>
            {PLANS.map((p) => (
              <div key={p.key} className="px-4 py-4 text-center">
                <p className={`text-sm font-black ${p.highlight ? 'text-sparknode-purple' : 'text-gray-800'}`}>
                  {p.name}
                </p>
              </div>
            ))}
          </div>

          {FEATURE_SECTIONS.map((section) => (
            <div key={section.title}>
              {/* Section header */}
              <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  {section.title}
                </span>
                {section.badge && (
                  <span className="text-xs font-bold bg-purple-100 text-sparknode-purple px-2 py-0.5 rounded-full">
                    {section.badge}
                  </span>
                )}
              </div>
              {/* Feature rows */}
              {section.features.map((feat, i) => (
                <div
                  key={feat.name}
                  className={`grid grid-cols-4 gap-0 border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  <div className="px-6 py-3.5 col-span-1 text-sm text-gray-700">
                    {feat.name}
                  </div>
                  <div className="px-4 py-3.5 text-center"><Check value={feat.core} /></div>
                  <div className="px-4 py-3.5 text-center"><Check value={feat.pro} /></div>
                  <div className="px-4 py-3.5 text-center"><Check value={feat.enterprise} /></div>
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
              q: 'How is "per employee" counted?',
              a: 'Active users in your tenant who were active in the billing month. Invited but never logged-in users are not counted.',
            },
            {
              q: 'Is there a free trial?',
              a: 'Every new tenant gets a 30-day Pro trial automatically. No credit card required.',
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-2">{q}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        {/* CTA banner */}
        <div className="bg-gradient-to-r from-sparknode-purple to-purple-700 rounded-2xl px-8 py-10 text-center text-white">
          <h2 className="text-3xl font-black mb-3">Ready to spark your team?</h2>
          <p className="text-white/80 mb-6 text-lg">
            30-day Pro trial, no credit card. Set up in under 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="bg-white text-sparknode-purple font-bold px-8 py-3 rounded-xl hover:bg-purple-50 transition-colors"
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
  )
}
