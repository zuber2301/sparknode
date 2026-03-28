/**
 * ExperienceContext — dual-experience state for SparkNode
 *
 * Experiences:
 *   engagement — Employee engagement, recognition, rewards, feed (Core)
 *   growth     — Sales campaigns, leads, events (Pro, feature-flagged)
 *
 * Usage:
 *   const { activeExperience, setExperience, availableExperiences, isProUser } = useExperience()
 *
 * Available-experience sources (merged, API wins):
 *   1. GET /auth/experiences  — server-authoritative; refreshed every 5 min
 *   2. Local calculation from tenantContext / user flags — used as fallback
 *      while the query is loading or the user is not yet logged in.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { experiencesAPI } from '../lib/api'

const STORAGE_KEY = 'sn_active_experience'

const ExperienceContext = createContext(null)

// ─── Static metadata (never changes — defined outside the component) ──────────

export const EXPERIENCE_META = {
  engagement: {
    label: 'SparkNode',
    shortLabel: 'SparkNode',
    tagline: 'Employee Engagement Platform (EEP)',
    icon: '🎯',
    color: 'purple',
    description: 'Culture & Rewards — recognition, events, gifting',
    href: '/dashboard',
  },
  growth: {
    label: 'IgniteNode',
    shortLabel: 'IgniteNode',
    tagline: 'Sales & Marketing',
    icon: '🔥',
    color: 'orange',
    description: 'Sales Events, Campaigns & Growth Events',
    features: ['Sales Events', 'Campaigns', 'Growth Events'],
    href: '/sales-events',
  },
}

// ─── Local fallback calculation ───────────────────────────────────────────────

function deriveExperiencesLocally(tenantContext, user) {
  // 1. Check enabled_modules (new provisioning) from user or tenant context
  const modules = user?.enabled_modules || tenantContext?.enabled_modules
  if (modules) {
    const exps = []
    if (modules.sparknode) exps.push('engagement')
    if (modules.ignitenode) exps.push('growth')
    // Safety: at least one module must be active
    if (exps.length === 0) exps.push('engagement')
    return exps
  }

  // 2. Legacy fallback: SparkNode always on, IgniteNode from flags/tier
  const experiences = ['engagement']
  const flags = tenantContext?.feature_flags || user?.tenant_flags || {}
  const tier = tenantContext?.subscription_tier || user?.subscription_tier || 'core'
  const salesEnabled =
    flags.sales_marketing ||
    flags.sales_marketing_enabled ||
    flags.sales_marketting_enabled // typo-tolerant
  if (tier === 'pro' || tier === 'enterprise' || salesEnabled) {
    experiences.push('growth')
  }
  return experiences
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ExperienceProvider({ children }) {
  const { user, tenantContext } = useAuthStore()

  // ── Server-authoritative source ────────────────────────────────────────────
  const { data: apiData } = useQuery({
    queryKey: ['experiences', user?.id],
    queryFn: () => experiencesAPI.getAvailable().then((r) => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,   // re-fetch at most every 5 min
    retry: 1,
  })

  // ── Derived state (stable references via useMemo) ──────────────────────────
  const availableExperiences = useMemo(() => {
    // API wins; fall back to local calculation while loading or on error
    if (apiData?.experiences?.length) return apiData.experiences
    return deriveExperiencesLocally(tenantContext, user)
  }, [apiData, tenantContext, user])

  const activeTier = apiData?.active_tier
    || tenantContext?.subscription_tier
    || user?.subscription_tier
    || 'core'

  const isProUser = useMemo(
    () =>
      availableExperiences.includes('growth') ||
      activeTier === 'pro' ||
      activeTier === 'enterprise',
    [availableExperiences, activeTier]
  )

  // ── Active experience (persisted across sessions) ──────────────────────────
  const [activeExperience, setActiveExperienceState] = useState(() => {
    // 1. Prefer user's assigned primary_module (set by admin)
    if (user?.primary_module === 'ignitenode') return 'growth'
    if (user?.primary_module === 'sparknode')  return 'engagement'
    // 2. Fall back to last session choice stored in localStorage
    const stored = localStorage.getItem(STORAGE_KEY)
    // Validate stored value against the initial local calculation; API may
    // expand the list later (see effect below).
    const initial = deriveExperiencesLocally(tenantContext, user)
    if (stored && initial.includes(stored)) return stored
    return initial[0] || 'engagement'
  })

  // When available experiences change (e.g. plan upgrade/downgrade, API loaded),
  // ensure activeExperience is still valid.
  useEffect(() => {
    if (!availableExperiences.includes(activeExperience)) {
      const fallback = availableExperiences[0] || 'engagement'
      setActiveExperienceState(fallback)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [availableExperiences, activeExperience])

  // ── Actions ────────────────────────────────────────────────────────────────
  const setExperience = useCallback(
    (exp) => {
      if (!availableExperiences.includes(exp)) {
        console.warn(`Experience "${exp}" is not available on the current plan.`)
        return false
      }
      localStorage.setItem(STORAGE_KEY, exp)
      setActiveExperienceState(exp)
      return true
    },
    [availableExperiences]
  )

  const experiencePath = useCallback(
    (path) => `/${activeExperience}${path}`,
    [activeExperience]
  )

  // ── Module access helpers ────────────────────────────────────────────────
  // Both spark_access and ignite_access are now derived from enabled_modules
  const igniteAccess = availableExperiences.includes('growth')
  const sparkAccess = availableExperiences.includes('engagement')
  // hasBothModules drives the Launchpad gateway visibility
  const hasBothModules = sparkAccess && igniteAccess
  // True when only one module is active (skip Gateway)
  const isSingleModule = !hasBothModules

  // ── Context value (memoized — only changes when something actually changes) ─
  const value = useMemo(
    () => ({
      activeExperience,
      setExperience,
      availableExperiences,
      isProUser,
      activeTier,
      isEngagement: activeExperience === 'engagement',
      isGrowth: activeExperience === 'growth',
      experiencePath,
      experienceMeta: EXPERIENCE_META,
      // Module access
      sparkAccess,
      igniteAccess,
      hasBothModules,
      isSingleModule,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeExperience, setExperience, availableExperiences, isProUser, activeTier, experiencePath, igniteAccess, sparkAccess]
  )

  return (
    <ExperienceContext.Provider value={value}>
      {children}
    </ExperienceContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useExperience() {
  const ctx = useContext(ExperienceContext)
  if (!ctx) {
    throw new Error('useExperience must be used inside <ExperienceProvider>')
  }
  return ctx
}

export default ExperienceContext
