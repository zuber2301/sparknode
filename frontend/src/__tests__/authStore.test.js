/**
 * Auth Store Tests
 * =================
 * Tests for the Zustand auth store: setAuth, logout, role management,
 * enabled_modules propagation, and persona switching.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore, UserRole, ROLE_DISPLAY_NAMES } from '../store/authStore'

// Reset store before each test
beforeEach(() => {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    tenantContext: null,
    personaRole: null,
    currentRole: null,
    availableRoles: [],
  })
})

describe('useAuthStore', () => {
  describe('setAuth', () => {
    it('sets user and token', () => {
      const user = {
        id: 'user-1',
        corporate_email: 'test@test.com',
        org_role: 'tenant_user',
        first_name: 'Test',
        last_name: 'User',
      }
      useAuthStore.getState().setAuth(user, 'test-token')
      const state = useAuthStore.getState()
      expect(state.user).toEqual(user)
      expect(state.token).toBe('test-token')
      expect(state.isAuthenticated).toBe(true)
    })

    it('sets enabled_modules in tenantContext from user', () => {
      const user = {
        id: 'user-1',
        org_role: 'tenant_user',
        tenant_id: 'tenant-1',
        tenant_name: 'TestCo',
        enabled_modules: { sparknode: true, ignitenode: true },
      }
      useAuthStore.getState().setAuth(user, 'token')
      const { tenantContext } = useAuthStore.getState()
      expect(tenantContext.enabled_modules).toEqual({ sparknode: true, ignitenode: true })
    })

    it('defaults enabled_modules when not provided', () => {
      const user = {
        id: 'user-2',
        org_role: 'tenant_user',
      }
      useAuthStore.getState().setAuth(user, 'token')
      const { tenantContext } = useAuthStore.getState()
      expect(tenantContext.enabled_modules).toEqual({ sparknode: true, ignitenode: false })
    })

    it('parses comma-separated roles', () => {
      const user = {
        id: 'user-3',
        org_role: 'tenant_manager',
        roles: 'tenant_manager,dept_lead,tenant_user',
        default_role: 'tenant_manager',
      }
      useAuthStore.getState().setAuth(user, 'token')
      const state = useAuthStore.getState()
      expect(state.availableRoles).toEqual(['tenant_manager', 'dept_lead', 'tenant_user'])
      expect(state.currentRole).toBe('tenant_manager')
    })

    it('uses org_role when roles string absent', () => {
      const user = {
        id: 'user-4',
        org_role: 'tenant_user',
      }
      useAuthStore.getState().setAuth(user, 'token')
      const state = useAuthStore.getState()
      expect(state.availableRoles).toEqual(['tenant_user'])
      expect(state.currentRole).toBe('tenant_user')
    })

    it('uses explicit tenantContext when provided', () => {
      const user = { id: 'user-5', org_role: 'tenant_user' }
      const ctx = {
        tenant_id: 'tid',
        tenant_name: 'ExplicitCo',
        feature_flags: { ai_copilot: true },
        enabled_modules: { sparknode: false, ignitenode: true },
      }
      useAuthStore.getState().setAuth(user, 'token', ctx)
      const { tenantContext } = useAuthStore.getState()
      expect(tenantContext.tenant_name).toBe('ExplicitCo')
      expect(tenantContext.enabled_modules.ignitenode).toBe(true)
    })
  })

  describe('logout', () => {
    it('clears all auth state', () => {
      useAuthStore.getState().setAuth(
        { id: 'user', org_role: 'tenant_user' },
        'token'
      )
      useAuthStore.getState().logout()
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.tenantContext).toBeNull()
      expect(state.currentRole).toBeNull()
      expect(state.availableRoles).toEqual([])
    })
  })
})

describe('UserRole constants', () => {
  it('has platform admin', () => {
    expect(UserRole.PLATFORM_ADMIN).toBe('platform_admin')
  })
  it('has tenant manager', () => {
    expect(UserRole.TENANT_MANAGER).toBe('tenant_manager')
  })
  it('has dept lead', () => {
    expect(UserRole.DEPT_LEAD).toBe('dept_lead')
  })
  it('has tenant user', () => {
    expect(UserRole.TENANT_USER).toBe('tenant_user')
  })
})

describe('ROLE_DISPLAY_NAMES', () => {
  it('has display names for all roles', () => {
    expect(ROLE_DISPLAY_NAMES.platform_admin).toBe('Platform Admin')
    expect(ROLE_DISPLAY_NAMES.tenant_manager).toBe('Tenant Manager')
    expect(ROLE_DISPLAY_NAMES.dept_lead).toBe('Department Lead')
    expect(ROLE_DISPLAY_NAMES.tenant_user).toBe('User')
    expect(ROLE_DISPLAY_NAMES.sales_marketing).toBe('IgniteNode')
  })
})
