import { useEffect, useMemo, useState, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { notificationsAPI, platformAPI, tenantsAPI } from '../lib/api'
import { CopilotProvider, useCopilot } from '../context/copilotContext'
import RightSideCopilot from './RightSideCopilot'
import {
  HiOutlineHome,
  HiOutlineSparkles,
  HiOutlineGift,
  HiOutlineNewspaper,
  HiOutlineCash,
  HiOutlineChartBar,
  HiOutlineTrendingUp,
  HiOutlineUsers,
  HiOutlineClipboardList,
  HiOutlineOfficeBuilding,
  HiOutlineBell,
  HiOutlineLogout,
  HiOutlineUser,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineSelector,
  HiOutlineCalendar,
} from 'react-icons/hi'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HiOutlineHome },
  { name: 'Events', href: '/events/browse', icon: HiOutlineCalendar },
  { name: 'Feed', href: '/feed', icon: HiOutlineNewspaper },
  { name: 'Recognize', href: '/recognize', icon: HiOutlineSparkles },
  { name: 'Redeem', href: '/redeem', icon: HiOutlineGift },
  { name: 'Wallet', href: '/wallet', icon: HiOutlineCash },
]

const adminNavigation = [
  { name: 'Events', href: '/events', icon: HiOutlineCalendar, roles: ['tenant_admin', 'hr_admin', 'platform_admin'] },
  { name: 'Tenants', href: '/platform/tenants', icon: HiOutlineOfficeBuilding, roles: ['platform_admin'] },
  { name: 'Budgets', href: '/budgets', icon: HiOutlineChartBar, roles: ['tenant_admin', 'hr_admin', 'platform_admin'] },
  { name: 'Spend Analysis', href: '/spend-analysis', icon: HiOutlineTrendingUp, roles: ['tenant_admin', 'hr_admin', 'platform_admin'] },
  { name: 'Users', href: '/users', icon: HiOutlineUsers, roles: ['tenant_admin', 'hr_admin', 'platform_admin'] },
  { name: 'Audit Log', href: '/audit', icon: HiOutlineClipboardList, roles: ['tenant_admin', 'hr_admin', 'platform_admin'] },
]

export default function Layout() {
  return (
    <CopilotProvider>
      <LayoutContent />
    </CopilotProvider>
  )
}

function LayoutContent() {
  const { isOpen } = useCopilot()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [tenantSearch, setTenantSearch] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [personaCollapsed, setPersonaCollapsed] = useState(false)
  const profileRef = useRef(null)
  const {
    user,
    logout,
    updateTenantContext,
    tenantContext,
    getEffectiveRole,
    setPersonaRole,
    clearPersonaRole,
    isPlatformOwnerUser,
    isPlatformOwner,
  } = useAuthStore()
  const navigate = useNavigate()

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false)
      }
    }

    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [profileOpen])

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

  const getRoleDisplayName = (role) => {
    const roles = {
      platform_admin: 'Platform Admin',
      tenant_admin: 'Tenant Admin',
      tenant_lead: 'Tenant Leader',
      corporate_user: 'Corporate User',
      hr_admin: 'Tenant Admin',
    }
    return roles[role] || role
  }

  const allTenants = tenantsResponse?.data
  useEffect(() => {
    if (!isPlatformUser) return
    if (tenantContext?.tenant_id) return
    const fallback = allTenants || tenants[0]
    if (fallback) {
      updateTenantContext({ tenant_id: fallback.id, tenant_name: fallback.name })
    }
  }, [isPlatformUser, tenantContext, tenants, updateTenantContext, allTenants])

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

            {isPlatformOwner() && (
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
                <p className="text-xs text-gray-500 truncate">
                  {getRoleDisplayName(effectiveRole)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`lg:pl-64 flex flex-col transition-all duration-300 ${isOpen ? 'pr-80' : ''}`}>
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
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100"
              >
                <HiOutlineUser className="w-6 h-6 text-gray-600" />
                <span className="hidden sm:inline text-sm text-gray-700 font-medium">
                  {user?.first_name} {user?.last_name}
                </span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    {tenantContext?.tenant_name && (
                      <>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          Tenant
                        </p>
                        <p className="text-sm font-medium text-gray-900 mb-3">
                          {tenantContext.tenant_name}
                        </p>
                      </>
                    )}
                    <p className="text-sm font-medium text-gray-900">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {getRoleDisplayName(effectiveRole)}
                    </p>
                  </div>
                  <div className="p-2">
                    <NavLink 
                      to="/profile" 
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <HiOutlineUser className="w-4 h-4" />
                      Profile
                    </NavLink>
                    <button
                      onClick={() => {
                        handleLogout()
                        setProfileOpen(false)
                      }}
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

      {/* Right-Side Copilot */}
      {isOpen && <RightSideCopilot />}

      {isPlatformUser && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-gradient-to-br from-sparknode-purple/5 to-sparknode-purple/10 border border-sparknode-purple/20 rounded-lg shadow-lg w-36">
            <button
              onClick={() => setPersonaCollapsed(!personaCollapsed)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-t-lg hover:bg-sparknode-purple/10 transition-colors border-b border-sparknode-purple/10"
            >
              <span className="text-[8px] font-black text-sparknode-purple uppercase tracking-wider">Persona</span>
              <span className={`text-sparknode-purple transition-transform duration-200 text-xs ${personaCollapsed ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            
            {!personaCollapsed && (
              <div className="p-1.5 space-y-1">
                {[
                  { value: 'tenant_admin', label: 'Tenant Admin', color: 'bg-sparknode-purple text-white' },
                  { value: 'tenant_lead', label: 'Tenant Leader', color: 'bg-sparknode-blue text-white' },
                  { value: 'corporate_user', label: 'Corporate User', color: 'bg-sparknode-green text-white' },
                ].map((persona) => (
                  <button
                    key={persona.value}
                    onClick={() => setPersonaRole(persona.value)}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors ${
                      effectiveRole === persona.value ? persona.color : 'bg-sparknode-purple/15 text-sparknode-purple hover:bg-sparknode-purple/25'
                    }`}
                  >
                    {persona.label}
                  </button>
                ))}
                <button
                  onClick={clearPersonaRole}
                  className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-sparknode-purple/20 text-sparknode-purple hover:bg-sparknode-purple/30 transition-colors"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
