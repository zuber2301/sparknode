import { createContext, useContext, useMemo } from 'react'
import { useAuthStore } from '../store/authStore'

const TenantContext = createContext({
  tenantContext: null,
  setTenantContext: () => {},
  clearTenantContext: () => {},
  personaRole: null,
  setPersonaRole: () => {},
  clearPersonaRole: () => {},
  effectiveRole: null,
  isPlatformOwnerUser: () => false,
  availableRoles: [],
  getAvailableRoles: () => [],
  switchRole: () => false,
  getCurrentRole: () => 'tenant_user',
})

export function TenantProvider({ children }) {
  const {
    tenantContext,
    updateTenantContext,
    setPersonaRole,
    clearPersonaRole,
    getEffectiveRole,
    isPlatformOwnerUser,
    personaRole,
    availableRoles,
    getAvailableRoles,
    switchRole,
    getCurrentRole,
  } = useAuthStore()

  const value = useMemo(() => ({
    tenantContext,
    setTenantContext: updateTenantContext,
    clearTenantContext: () => updateTenantContext({ tenant_id: null, tenant_name: null }),
    personaRole,
    setPersonaRole,
    clearPersonaRole,
    effectiveRole: getEffectiveRole(),
    isPlatformOwnerUser,
    availableRoles,
    getAvailableRoles,
    switchRole,
    getCurrentRole,
  }), [
    tenantContext,
    updateTenantContext,
    personaRole,
    setPersonaRole,
    clearPersonaRole,
    getEffectiveRole,
    isPlatformOwnerUser,
    availableRoles,
    getAvailableRoles,
    switchRole,
    getCurrentRole,
  ])

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenantContext() {
  return useContext(TenantContext)
}

export default TenantContext