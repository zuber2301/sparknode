/**
 * Module Configuration Tests
 * ============================
 * Tests for the module access derivation logic used across the app.
 * Covers all login scenarios: SparkNode-only, IgniteNode-only, both modules.
 */

import { describe, it, expect } from 'vitest'

// ─── Module access derivation (mirrors ExperienceContext logic) ─────────

function getModuleAccess(enabledModules) {
  if (!enabledModules) {
    return { sparkAccess: true, igniteAccess: false, hasBothModules: false, isSingleModule: true }
  }
  const sparkAccess = !!enabledModules.sparknode
  const igniteAccess = !!enabledModules.ignitenode
  const hasBothModules = sparkAccess && igniteAccess
  const isSingleModule = !hasBothModules
  return { sparkAccess, igniteAccess, hasBothModules, isSingleModule }
}

describe('Module Access Derivation', () => {
  it('sparknode only', () => {
    const access = getModuleAccess({ sparknode: true, ignitenode: false })
    expect(access.sparkAccess).toBe(true)
    expect(access.igniteAccess).toBe(false)
    expect(access.hasBothModules).toBe(false)
    expect(access.isSingleModule).toBe(true)
  })

  it('ignitenode only', () => {
    const access = getModuleAccess({ sparknode: false, ignitenode: true })
    expect(access.sparkAccess).toBe(false)
    expect(access.igniteAccess).toBe(true)
    expect(access.hasBothModules).toBe(false)
    expect(access.isSingleModule).toBe(true)
  })

  it('both modules', () => {
    const access = getModuleAccess({ sparknode: true, ignitenode: true })
    expect(access.sparkAccess).toBe(true)
    expect(access.igniteAccess).toBe(true)
    expect(access.hasBothModules).toBe(true)
    expect(access.isSingleModule).toBe(false)
  })

  it('neither module (edge case)', () => {
    const access = getModuleAccess({ sparknode: false, ignitenode: false })
    expect(access.sparkAccess).toBe(false)
    expect(access.igniteAccess).toBe(false)
    expect(access.hasBothModules).toBe(false)
    expect(access.isSingleModule).toBe(true)
  })

  it('null/undefined defaults to sparknode only', () => {
    const access = getModuleAccess(null)
    expect(access.sparkAccess).toBe(true)
    expect(access.igniteAccess).toBe(false)
    expect(access.isSingleModule).toBe(true)
  })
})

// ─── Login redirect logic (mirrors Login.jsx redirectAfterLogin) ─────────

function getLoginRedirect(user) {
  if (user.is_platform_admin) return '/admin/tenants'

  const modules = user.enabled_modules
  if (modules) {
    const spark = !!modules.sparknode
    const ignite = !!modules.ignitenode
    if (spark && ignite) return '/gateway'
    if (ignite && !spark) return '/ignitenode'
    return '/dashboard'
  }

  // Legacy fallback
  const flags = user.tenant_flags || {}
  const salesEnabled = flags.sales_marketing || flags.sales_marketing_enabled || flags.sales_marketting_enabled
  if (salesEnabled) return '/gateway'
  return '/dashboard'
}

describe('Login Redirect Logic', () => {
  it('platform admin → /admin/tenants', () => {
    expect(getLoginRedirect({ is_platform_admin: true })).toBe('/admin/tenants')
  })

  it('sparknode only → /dashboard', () => {
    expect(getLoginRedirect({
      enabled_modules: { sparknode: true, ignitenode: false }
    })).toBe('/dashboard')
  })

  it('ignitenode only → /ignitenode', () => {
    expect(getLoginRedirect({
      enabled_modules: { sparknode: false, ignitenode: true }
    })).toBe('/ignitenode')
  })

  it('both modules → /gateway', () => {
    expect(getLoginRedirect({
      enabled_modules: { sparknode: true, ignitenode: true }
    })).toBe('/gateway')
  })

  it('legacy with sales flag → /gateway', () => {
    expect(getLoginRedirect({
      tenant_flags: { sales_marketing: true }
    })).toBe('/gateway')
  })

  it('legacy without sales flag → /dashboard', () => {
    expect(getLoginRedirect({
      tenant_flags: {}
    })).toBe('/dashboard')
  })

  it('legacy with typo flag → /gateway', () => {
    expect(getLoginRedirect({
      tenant_flags: { sales_marketting_enabled: true }
    })).toBe('/gateway')
  })
})

// ─── Gateway auto-redirect logic ────────────────────────────────────────

function getGatewayRedirect(sparkAccess, igniteAccess) {
  if (sparkAccess && igniteAccess) return null  // Show gateway
  if (igniteAccess && !sparkAccess) return '/ignitenode'
  return '/dashboard'  // SparkNode or fallback
}

describe('Gateway Auto-Redirect Logic', () => {
  it('both modules → null (show gateway)', () => {
    expect(getGatewayRedirect(true, true)).toBeNull()
  })

  it('ignitenode only → /ignitenode', () => {
    expect(getGatewayRedirect(false, true)).toBe('/ignitenode')
  })

  it('sparknode only → /dashboard', () => {
    expect(getGatewayRedirect(true, false)).toBe('/dashboard')
  })

  it('neither → /dashboard (fallback)', () => {
    expect(getGatewayRedirect(false, false)).toBe('/dashboard')
  })
})

// ─── Tenant provisioning module defaults ────────────────────────────────

describe('Tenant Provisioning Module Defaults', () => {
  const DEFAULT_MODULES = { sparknode: true, ignitenode: false }

  it('default has SparkNode enabled', () => {
    expect(DEFAULT_MODULES.sparknode).toBe(true)
  })

  it('default has IgniteNode disabled', () => {
    expect(DEFAULT_MODULES.ignitenode).toBe(false)
  })

  it('at least one module must be enabled validation', () => {
    const modules = { sparknode: false, ignitenode: false }
    const atLeastOne = Object.values(modules).some(Boolean)
    expect(atLeastOne).toBe(false) // This should fail validation at the UI
  })

  it('at least one enabled passes', () => {
    const modules = { sparknode: true, ignitenode: false }
    const atLeastOne = Object.values(modules).some(Boolean)
    expect(atLeastOne).toBe(true)
  })
})
