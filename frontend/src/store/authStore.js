import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Role hierarchy constants
export const UserRole = {
  PLATFORM_ADMIN: 'platform_admin',
  TENANT_ADMIN: 'tenant_manager',
  TENANT_MANAGER: 'tenant_manager',
  TENANT_LEAD: 'dept_lead',
  CORPORATE_USER: 'corporate_user',
  // Legacy mappings
  HR_ADMIN: 'hr_admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
}

// Role hierarchy levels (higher = more permissions)
const ROLE_HIERARCHY = {
  platform_admin: 100,
  tenant_manager: 80,
  hr_admin: 80, // Legacy alias
  dept_lead: 60,
  tenant_lead: 60, // Legacy alias
  manager: 60, // Legacy alias
  corporate_user: 40,
  employee: 40, // Legacy alias
}

// Normalize legacy roles to new roles
const normalizeRole = (role) => {
  const legacyMap = {
    hr_admin: 'tenant_manager',
    manager: 'dept_lead',
    tenant_lead: 'dept_lead',
    employee: 'corporate_user',
  }
  return legacyMap[role] || role
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      tenantContext: null, // { tenant_id, tenant_name, subscription_tier, settings }
      personaRole: null, // platform admin UI override

      setAuth: (user, token, tenantContext = null) => {
        set({
          user,
          token,
          isAuthenticated: true,
          tenantContext: tenantContext || {
            tenant_id: user?.tenant_id,
            tenant_name: user?.tenant_name,
          },
        })
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          tenantContext: null,
        })
      },

      updateUser: (userData) => {
        set({
          user: { ...get().user, ...userData },
        })
      },

      updateTenantContext: (tenantData) => {
        set({
          tenantContext: { ...get().tenantContext, ...tenantData },
        })
      },

      setPersonaRole: (role) => {
        const { user } = get()
        const actualRole = normalizeRole(user?.org_role)
        if (actualRole !== 'platform_admin') return
        set({ personaRole: role })
      },

      clearPersonaRole: () => {
        set({ personaRole: null })
      },

      getEffectiveRole: () => {
        const { user, personaRole } = get()
        const actualRole = normalizeRole(user?.org_role)
        if (actualRole === 'platform_admin' && personaRole) {
          return personaRole
        }
        return actualRole
      },

      // Role hierarchy helpers
      getNormalizedRole: () => {
        const { getEffectiveRole } = get()
        return getEffectiveRole()
      },

      getRoleLevel: () => {
        const { getEffectiveRole } = get()
        const role = getEffectiveRole()
        return ROLE_HIERARCHY[role] || 0
      },

      hasMinimumRole: (requiredRole) => {
        const { getRoleLevel } = get()
        const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0
        return getRoleLevel() >= requiredLevel
      },

      // Platform Admin check
      isPlatformOwner: () => {
        const { getEffectiveRole } = get()
        return getEffectiveRole() === 'platform_admin'
      },

      // Platform Admin (actual user role)
      isPlatformOwnerUser: () => {
        const { user } = get()
        return normalizeRole(user?.org_role) === 'platform_admin'
      },

      // Tenant Manager check (includes Platform Admin)
      isTenantAdmin: () => {
        const { getEffectiveRole } = get()
        return getEffectiveRole() === 'tenant_manager' || getEffectiveRole() === 'platform_admin'
      },

      // Tenant Lead check (includes Tenant Manager and above)
      isTenantLead: () => {
        const { getEffectiveRole, isTenantAdmin } = get()
        return isTenantAdmin() || getEffectiveRole() === 'dept_lead'
      },

      // Any authenticated user within tenant
      isCorporateUser: () => {
        const { isAuthenticated } = get()
        return isAuthenticated
      },

      // Legacy compatibility methods
      isHRAdmin: () => {
        return get().isTenantAdmin()
      },

      isManager: () => {
        return get().isTenantLead()
      },

      // Permission checks
      canManageTenant: () => {
        return get().isTenantAdmin()
      },

      canManageUsers: () => {
        return get().isTenantAdmin()
      },

      canManageBudgets: () => {
        return get().isTenantAdmin()
      },

      canApproveTeamRecognitions: () => {
        return get().isTenantLead()
      },

      canGiveRecognition: () => {
        return get().isAuthenticated
      },

      canViewAnalytics: () => {
        return get().isTenantLead()
      },

      canManageEvents: () => {
        return get().isTenantLead()
      },

      canViewPlatformMetrics: () => {
        return get().isPlatformOwner()
      },

      // Tenant context helpers
      getTenantId: () => {
        const { tenantContext, user } = get()
        const zeroUUID = '00000000-0000-0000-0000-000000000000'
        
        // Prefer tenantContext if it has a valid (non-zero) tenant_id
        if (tenantContext?.tenant_id && tenantContext.tenant_id !== zeroUUID) {
          return tenantContext.tenant_id
        }
        
        // Fall back to user's tenant_id (even if it's the zero UUID for system admin)
        if (user?.tenant_id) {
          return user.tenant_id
        }
        
        return null
      },

      getTenantName: () => {
        const { tenantContext, user } = get()
        return tenantContext?.tenant_name || user?.tenant_name
      },

      getSubscriptionTier: () => {
        const { tenantContext } = get()
        return tenantContext?.subscription_tier || 'free'
      },

      // Feature access based on subscription tier
      hasFeature: (feature) => {
        const { getSubscriptionTier } = get()
        const tier = getSubscriptionTier()
        
        const featureTiers = {
          basic_recognition: ['free', 'starter', 'professional', 'enterprise'],
          advanced_analytics: ['professional', 'enterprise'],
          events_management: ['starter', 'professional', 'enterprise'],
          custom_branding: ['professional', 'enterprise'],
          api_access: ['enterprise'],
          white_label: ['enterprise'],
          sso: ['enterprise'],
          unlimited_users: ['enterprise'],
        }
        
        return featureTiers[feature]?.includes(tier) || false
      },
    }),
    {
      name: 'sparknode-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        tenantContext: state.tenantContext,
      }),
    }
  )
)

