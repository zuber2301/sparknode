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
  }), [
    tenantContext,
    updateTenantContext,
    personaRole,
    setPersonaRole,
    clearPersonaRole,
    getEffectiveRole,
    isPlatformOwnerUser,
  ])

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenantContext() {
  return useContext(TenantContext)
}

export default TenantContext