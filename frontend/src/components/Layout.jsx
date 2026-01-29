import { useEffect, useMemo, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { notificationsAPI, platformAPI, tenantsAPI } from '../lib/api'
import {
  HiOutlineHome,
  HiOutlineSparkles,
  HiOutlineGift,
  HiOutlineNewspaper,
  HiOutlineCash,
  HiOutlineChartBar,
  HiOutlineUsers,
  HiOutlineClipboardList,
  HiOutlineOfficeBuilding,
  HiOutlineBell,
  HiOutlineLogout,
  HiOutlineUser,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineSelector
} from 'react-icons/hi'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HiOutlineHome },
  { name: 'Feed', href: '/feed', icon: HiOutlineNewspaper },
  { name: 'Recognize', href: '/recognize', icon: HiOutlineSparkles },
  { name: 'Redeem', href: '/redeem', icon: HiOutlineGift },
  { name: 'Wallet', href: '/wallet', icon: HiOutlineCash },
]

const adminNavigation = [
  { name: 'Tenants', href: '/platform/tenants', icon: HiOutlineOfficeBuilding, roles: ['platform_admin'] },
  { name: 'Budgets', href: '/budgets', icon: HiOutlineChartBar, roles: ['tenant_admin', 'hr_admin', 'platform_admin'] },
  { name: 'Users', href: '/users', icon: HiOutlineUsers, roles: ['tenant_admin', 'hr_admin', 'platform_admin'] },
  { name: 'Audit Log', href: '/audit', icon: HiOutlineClipboardList, roles: ['tenant_admin', 'hr_admin', 'platform_admin'] },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [tenantSearch, setTenantSearch] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const {
    user,
    logout,
    updateTenantContext,
    tenantContext,
    getEffectiveRole,
    setPersonaRole,
    clearPersonaRole,
    isPlatformOwnerUser,
  } = useAuthStore()
  const navigate = useNavigate()

  const { data: notificationCount } = useQuery({
    queryKey: ['notificationCount'],
    queryFn: () => notificationsAPI.getCount(),
    refetchInterval: 30000,
  })

  const isPlatformUser = isPlatformOwnerUser()

  const { data: currentTenantResponse } = useQuery({
    queryKey: ['currentTenant'],
    queryFn: () => tenantsAPI.getCurrent(),
    enabled: !isPlatformUser,
  })

  const { data: tenantsResponse } = useQuery({
    queryKey: ['platformTenantsSelector'],
    queryFn: () => platformAPI.getTenants({ limit: 200 }),
    enabled: isPlatformOwnerUser(),
  })

  const tenants = useMemo(() => tenantsResponse?.data || [], [tenantsResponse])
  const effectiveRole = getEffectiveRole()
  const filteredTenants = useMemo(() => {
    if (!tenantSearch) return tenants
    const term = tenantSearch.toLowerCase()
    return tenants.filter((tenant) =>
      `${tenant.name} ${tenant.domain || ''} ${tenant.slug || ''}`.toLowerCase().includes(term)
    )
  }, [tenantSearch, tenants])

  const contextTitle = tenantContext?.tenant_name === 'All Tenants' ? 'Context' : 'Context Set'
  const contextName = tenantContext?.tenant_name || (isPlatformUser ? 'All Tenants' : '—')
  const contextId = tenantContext?.tenant_id ? tenantContext.tenant_id : '—'

  useEffect(() => {
    if (!isPlatformUser || !tenants.length) return
    if (tenantContext?.tenant_id) return
    const allTenants = tenants.find((tenant) => tenant.name === 'All Tenants')
    const fallback = allTenants || tenants[0]
    if (fallback) {
      updateTenantContext({ tenant_id: fallback.id, tenant_name: fallback.name })
    }
  }, [isPlatformUser, tenantContext, tenants, updateTenantContext])

  useEffect(() => {
    if (isPlatformUser) return
    if (tenantContext?.tenant_id) return
    const tenant = currentTenantResponse?.data
    if (tenant?.id) {
      updateTenantContext({ tenant_id: tenant.id, tenant_name: tenant.name })
    }
  }, [currentTenantResponse, isPlatformUser, tenantContext, updateTenantContext])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const canAccess = (roles) => {
    if (!roles) return true
    return roles.includes(effectiveRole)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SN</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-sparknode-purple to-sparknode-blue bg-clip-text text-transparent">
                SparkNode
              </span>
            </div>
            <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <HiOutlineX className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}

            {adminNavigation.some(item => canAccess(item.roles)) && (
              <>
                <div className="pt-4 pb-2">
                  <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Admin
                  </p>
                </div>
                {adminNavigation.map((item) => (
                  canAccess(item.roles) && (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </NavLink>
                  )
                ))}
              </>
            )}

            {isPlatformUser && (
              <div className="pt-4">
                <div className="px-4 pb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Tenant Context
                  </p>
                </div>
                <div className="px-4">
                  <input
                    value={tenantSearch}
                    onChange={(e) => setTenantSearch(e.target.value)}
                    className="input text-sm"
                    placeholder="Search tenants..."
                  />
                </div>
                <div className="mt-3 max-h-56 overflow-y-auto px-2 space-y-1">
                  {filteredTenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => updateTenantContext({ tenant_id: tenant.id, tenant_name: tenant.name })}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        tenantContext?.tenant_id === tenant.id
                          ? 'bg-sparknode-purple/10 text-sparknode-purple'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-xs text-gray-500">{tenant.domain || tenant.slug || '-'}</p>
                    </button>
                  ))}
                  {filteredTenants.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-400">No tenants found</div>
                  )}
                </div>
              </div>
            )}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-sparknode-purple to-sparknode-blue flex items-center justify-center text-white font-medium">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {effectiveRole === 'platform_admin' ? 'Perksu Admin' : effectiveRole?.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 lg:px-8 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
            >
              <HiOutlineMenu className="w-6 h-6" />
            </button>
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SN</span>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-sparknode-purple to-sparknode-blue bg-clip-text text-transparent">
                SparkNode
              </span>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <div className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 leading-tight">
              <div className="font-semibold uppercase tracking-wide text-[10px] text-gray-400">{contextTitle}</div>
              <div className="text-sm font-medium text-gray-900">{contextName}</div>
              <div className="text-[11px] text-gray-500 truncate max-w-[180px]">{contextName === 'All Tenants' ? 'All Tenant' : contextId}</div>
            </div>
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-gray-100">
              <HiOutlineBell className="w-6 h-6 text-gray-600" />
              {notificationCount?.data?.unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 text-xs font-medium text-white bg-red-500 rounded-full flex items-center justify-center">
                  {notificationCount.data.unread > 9 ? '9+' : notificationCount.data.unread}
                </span>
              )}
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <HiOutlineUser className="w-6 h-6 text-gray-600" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {effectiveRole === 'platform_admin' ? 'Perksu Admin' : effectiveRole?.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="p-2">
                    <NavLink to="/profile" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                      <HiOutlineUser className="w-4 h-4" />
                      Profile
                    </NavLink>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                    >
                      <HiOutlineLogout className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {isPlatformUser && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-44">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Persona</div>
            <div className="space-y-2">
              {[
                { value: 'tenant_admin', label: 'Tenant Admin', color: 'bg-sparknode-purple text-white' },
                { value: 'tenant_lead', label: 'Tenant Leader', color: 'bg-sparknode-blue text-white' },
                { value: 'corporate_user', label: 'Corporate User', color: 'bg-sparknode-green text-white' },
              ].map((persona) => (
                <button
                  key={persona.value}
                  onClick={() => setPersonaRole(persona.value)}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] font-medium ${
                    effectiveRole === persona.value ? persona.color : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {persona.label}
                </button>
              ))}
              <button
                onClick={clearPersonaRole}
                className="w-full text-left px-2 py-1.5 rounded-md text-[10px] font-medium bg-gray-50 text-gray-500"
              >
                Reset to Platform Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
