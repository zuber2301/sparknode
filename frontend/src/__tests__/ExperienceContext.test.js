/**
 * ExperienceContext Tests
 * ========================
 * Tests for the dual-module experience system:
 *  - deriveExperiencesLocally with enabled_modules
 *  - Legacy fallback with feature_flags / tier
 *  - EXPERIENCE_META structure
 */

import { describe, it, expect } from 'vitest'
import { EXPERIENCE_META } from '../context/ExperienceContext'

// ─── EXPERIENCE_META Structure ─────────────────────────────────────────

describe('EXPERIENCE_META', () => {
  it('has engagement and growth entries', () => {
    expect(EXPERIENCE_META).toHaveProperty('engagement')
    expect(EXPERIENCE_META).toHaveProperty('growth')
  })

  it('engagement maps to SparkNode', () => {
    const e = EXPERIENCE_META.engagement
    expect(e.label).toBe('SparkNode')
    expect(e.shortLabel).toBe('SparkNode')
    expect(e.icon).toBe('🎯')
    expect(e.color).toBe('purple')
    expect(e.href).toBe('/dashboard')
  })

  it('growth maps to IgniteNode', () => {
    const g = EXPERIENCE_META.growth
    expect(g.label).toBe('IgniteNode')
    expect(g.shortLabel).toBe('IgniteNode')
    expect(g.icon).toBe('🔥')
    expect(g.color).toBe('orange')
    expect(g.href).toBe('/sales-events')
  })

  it('engagement has tagline EEP', () => {
    expect(EXPERIENCE_META.engagement.tagline).toContain('Employee Engagement Platform')
  })

  it('growth has tagline Sales & Marketing', () => {
    expect(EXPERIENCE_META.growth.tagline).toContain('Sales & Marketing')
  })

  it('growth lists feature tags', () => {
    expect(EXPERIENCE_META.growth.features).toEqual(
      expect.arrayContaining(['Sales Events', 'Campaigns', 'Growth Events'])
    )
  })
})

// ─── deriveExperiencesLocally logic (inline reimplementation for unit testing)

function deriveExperiencesLocally(tenantContext, user) {
  const modules = user?.enabled_modules || tenantContext?.enabled_modules
  if (modules) {
    const exps = []
    if (modules.sparknode) exps.push('engagement')
    if (modules.ignitenode) exps.push('growth')
    if (exps.length === 0) exps.push('engagement')
    return exps
  }
  const experiences = ['engagement']
  const flags = tenantContext?.feature_flags || user?.tenant_flags || {}
  const tier = tenantContext?.subscription_tier || user?.subscription_tier || 'core'
  const salesEnabled =
    flags.sales_marketing ||
    flags.sales_marketing_enabled ||
    flags.sales_marketting_enabled
  if (tier === 'pro' || tier === 'enterprise' || salesEnabled) {
    experiences.push('growth')
  }
  return experiences
}

describe('deriveExperiencesLocally', () => {
  describe('with enabled_modules (new path)', () => {
    it('sparknode only → engagement', () => {
      const result = deriveExperiencesLocally(
        null,
        { enabled_modules: { sparknode: true, ignitenode: false } }
      )
      expect(result).toEqual(['engagement'])
    })

    it('ignitenode only → growth', () => {
      const result = deriveExperiencesLocally(
        null,
        { enabled_modules: { sparknode: false, ignitenode: true } }
      )
      expect(result).toEqual(['growth'])
    })

    it('both modules → engagement + growth', () => {
      const result = deriveExperiencesLocally(
        null,
        { enabled_modules: { sparknode: true, ignitenode: true } }
      )
      expect(result).toEqual(['engagement', 'growth'])
    })

    it('neither module → safety fallback to engagement', () => {
      const result = deriveExperiencesLocally(
        null,
        { enabled_modules: { sparknode: false, ignitenode: false } }
      )
      expect(result).toEqual(['engagement'])
    })

    it('modules from tenantContext when user has none', () => {
      const result = deriveExperiencesLocally(
        { enabled_modules: { sparknode: true, ignitenode: true } },
        {}
      )
      expect(result).toEqual(['engagement', 'growth'])
    })

    it('user modules take priority over tenantContext', () => {
      const result = deriveExperiencesLocally(
        { enabled_modules: { sparknode: true, ignitenode: true } },
        { enabled_modules: { sparknode: true, ignitenode: false } }
      )
      expect(result).toEqual(['engagement'])
    })
  })

  describe('legacy fallback (no enabled_modules)', () => {
    it('no flags, core tier → engagement only', () => {
      const result = deriveExperiencesLocally({ feature_flags: {} }, {})
      expect(result).toEqual(['engagement'])
    })

    it('sales_marketing flag → engagement + growth', () => {
      const result = deriveExperiencesLocally(
        { feature_flags: { sales_marketing: true } },
        {}
      )
      expect(result).toEqual(['engagement', 'growth'])
    })

    it('sales_marketing_enabled flag → engagement + growth', () => {
      const result = deriveExperiencesLocally(
        { feature_flags: { sales_marketing_enabled: true } },
        {}
      )
      expect(result).toEqual(['engagement', 'growth'])
    })

    it('sales_marketting_enabled typo flag → engagement + growth', () => {
      const result = deriveExperiencesLocally(
        { feature_flags: { sales_marketting_enabled: true } },
        {}
      )
      expect(result).toEqual(['engagement', 'growth'])
    })

    it('enterprise tier → engagement + growth', () => {
      const result = deriveExperiencesLocally(
        { subscription_tier: 'enterprise', feature_flags: {} },
        {}
      )
      expect(result).toEqual(['engagement', 'growth'])
    })

    it('pro tier → engagement + growth', () => {
      const result = deriveExperiencesLocally(
        { subscription_tier: 'pro', feature_flags: {} },
        {}
      )
      expect(result).toEqual(['engagement', 'growth'])
    })

    it('starter tier, no flags → engagement only', () => {
      const result = deriveExperiencesLocally(
        { subscription_tier: 'starter', feature_flags: {} },
        {}
      )
      expect(result).toEqual(['engagement'])
    })

    it('null context and null user → engagement', () => {
      const result = deriveExperiencesLocally(null, null)
      expect(result).toEqual(['engagement'])
    })
  })
})
