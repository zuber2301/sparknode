/**
 * ExperienceContext — dual-experience state for SparkNode
 *
 * Experiences:
 *   engagement — Employee engagement, recognition, rewards, feed (Core)
 *   growth     — Sales campaigns, leads, events (Pro, feature-flagged)
 *
 * Usage:
 *   const { activeExperience, setExperience, availableExperiences, isProUser } = useExperience()
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'

const STORAGE_KEY = 'sn_active_experience'

const ExperienceContext = createContext(null)

// ─── helpers ────────────────────────────────────────────────────────────────

function getAvailableExperiences(tenantContext, user) {
  const experiences = ['engagement'] // always available

  const flags = tenantContext?.feature_flags || user?.tenant_flags || {}
  const tier = tenantContext?.subscription_tier || user?.subscription_tier || 'core'

  const salesEnabled =
    flags.sales_marketing ||
    flags.sales_marketing_enabled ||
    flags.sales_marketting_enabled // typo-tolerant

  const isPro = tier === 'pro' || tier === 'enterprise'

  // Growth experience: requires Pro tier OR explicit sales feature flag
  if (isPro || salesEnabled) {
    experiences.push('growth')
  }

  return experiences
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ExperienceProvider({ children }) {
  const { user, tenantContext } = useAuthStore()

  const availableExperiences = getAvailableExperiences(tenantContext, user)
  const isProUser =
    availableExperiences.includes('growth') ||
    ['pro', 'enterprise'].includes(
      tenantContext?.subscription_tier || user?.subscription_tier
    )

  const [activeExperience, setActiveExperienceState] = useState(() => {
    // Restore from localStorage; fall back to engagement
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && availableExperiences.includes(stored)) return stored
    return 'engagement'
  })

  // If stored experience is no longer available (e.g. plan downgrade), reset
  useEffect(() => {
    if (!availableExperiences.includes(activeExperience)) {
      setActiveExperienceState('engagement')
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [availableExperiences, activeExperience])

  const setExperience = useCallback(
    (exp) => {
      if (!availableExperiences.includes(exp)) {
        console.warn(`Experience "${exp}" is not available on this plan.`)
        return false
      }
      localStorage.setItem(STORAGE_KEY, exp)
      setActiveExperienceState(exp)
      return true
    },
    [availableExperiences]
  )

  // Convenience: is the currently viewed experience "engagement"
  const isEngagement = activeExperience === 'engagement'
  const isGrowth = activeExperience === 'growth'

  // Route-prefix helper — prepend /engagement or /growth when experience routing is needed
  const experiencePath = useCallback(
    (path) => `/${activeExperience}${path}`,
    [activeExperience]
  )

  const value = {
    activeExperience,
    setExperience,
    availableExperiences,
    isProUser,
    isEngagement,
    isGrowth,
    experiencePath,
    // Metadata for display
    experienceMeta: {
      engagement: {
        label: 'Employee Engagement',
        shortLabel: 'Engagement',
        icon: '🎯',
        color: 'purple',
        description: 'Recognition, rewards & culture tools for your team',
        href: '/dashboard',
      },
      growth: {
        label: 'Growth Events',
        shortLabel: 'Growth',
        icon: '🚀',
        color: 'blue',
        description: 'Sales campaigns, leads & event ROI tracking',
        href: '/sales-events',
      },
    },
  }

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
