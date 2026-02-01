import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { notificationsAPI, platformAPI, tenantsAPI, authAPI } from '../lib/api'
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
  HiOutlineChevronDown,
  HiOutlineShoppingCart,
  HiOutlineCog,
  HiOutlineViewGrid,
  HiOutlineCreditCard,
  HiOutlineMailOpen,
} from 'react-icons/hi'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HiOutlineHome },
  { name: 'Events', href: '/events/browse', icon: HiOutlineNewspaper },
  { name: 'Feed', href: '/feed', icon: HiOutlineNewspaper },
  { name: 'Recognize', href: '/recognize', icon: HiOutlineSparkles },
  { name: 'Redeem', href: '/redeem', icon: HiOutlineGift },
  { name: 'Wallet', href: '/wallet', icon: HiOutlineCash },
]

const adminNavigation = [
  { name: 'Tenants', href: '/platform/tenants', icon: HiOutlineOfficeBuilding, roles: ['platform_admin'] },
  { name: 'Budgets', href: '/budgets', icon: HiOutlineChartBar, roles: ['tenant_admin', 'hr_admin', 'platform_admin'] },
  { name: 'Users', href: '/users', icon: HiOutlineUsers, roles: ['tenant_admin', 'hr_admin', 'platform_admin'] },
  { name: 'Invite Users', href: '/admin/invite-users', icon: HiOutlineMailOpen, roles: ['tenant_admin', 'hr_admin'] },
  { name: 'Audit Log', href: '/audit', icon: HiOutlineClipboardList, roles: ['tenant_admin', 'hr_admin', 'platform_admin'] },
  { name: 'Marketplace', href: '/marketplace', icon: HiOutlineShoppingCart, roles: ['platform_admin'] },
  { name: 'AI Settings', href: '/ai-settings', icon: HiOutlineCog, roles: ['platform_admin'] },
  { name: 'Templates', href: '/templates', icon: HiOutlineViewGrid, roles: ['platform_admin'] },
  { name: 'Billing', href: '/billing', icon: HiOutlineCreditCard, roles: ['platform_admin'] },
]

export default function TopHeader() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [tenantSelectorOpen, setTenantSelectorOpen] = useState(false)
  const [personaExpandOpen, setPersonaExpandOpen] = useState(false)
  const [tenantSearch, setTenantSearch] = useState('')
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
    updateUser,
  } = useAuthStore()
  const { canGiveRecognition, canManageBudgets, canApproveTeamRecognitions, canViewAnalytics } = useAuthStore()
  const navigate = useNavigate()

  // Fetch fresh user data on mount to ensure we have current first_name and last_name
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authAPI.me(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    onSuccess: (response) => {
      if (response?.data?.id) {
        updateUser(response.data)
      }
    },
  })

  // Close dropdowns when clicking outside
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

  const tenants = tenantsResponse?.data || []
  const effectiveRole = getEffectiveRole()
  const filteredTenants = tenantSearch
    ? tenants.filter((tenant) =>
        `${tenant.name} ${tenant.domain || ''} ${tenant.slug || ''}`.toLowerCase().includes(tenantSearch.toLowerCase())
      )
    : tenants

  const contextTitle = tenantContext?.tenant_name === 'All Tenants' ? 'Context' : 'Context Set'
  const contextName = tenantContext?.tenant_name || (isPlatformUser ? 'All Tenants' : '—')

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

  // Format fallback display name from email local-part (e.g. super_user -> Super User)
  const formatLocalPart = (local) => {
    if (!local) return ''
    return local
      .split(/[_\.\-]+/) // split on underscore, dot, dash
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  const getDisplayName = () => {
    if (user?.first_name) return user.first_name
    const local = user?.email?.split('@')[0]
    return formatLocalPart(local) || 'User'
  }

  const getInitials = () => {
    if (user?.first_name || user?.last_name) {
      const a = user?.first_name?.[0] || ''
      const b = user?.last_name?.[0] || ''
      return (a + b).toUpperCase()
    }
    const parts = getDisplayName().split(' ').filter(Boolean)
    return (parts[0]?.[0] || 'U') + (parts[1]?.[0] || '')
  }

  const canAccess = (roles) => {
    if (!roles) return true
    return roles.includes(effectiveRole)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
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

  return (
    <>
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      {/* Main header */}
      <div className="px-2 lg:px-3">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo + Mobile Menu Button */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            >
              {mobileNavOpen ? (
                <HiOutlineX className="w-6 h-6" />
              ) : (
                <HiOutlineMenu className="w-6 h-6" />
              )}
            </button>
            <NavLink to="/dashboard" className="flex items-center gap-2 hover:opacity-75 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-r from-sparknode-purple to-sparknode-blue rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">SN</span>
              </div>
              <span className="hidden sm:inline text-xl font-bold bg-gradient-to-r from-sparknode-purple to-sparknode-blue bg-clip-text text-transparent">
                SparkNode
              </span>
            </NavLink>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 flex-1">
            {!isPlatformUser && effectiveRole === 'tenant_admin' ? (
              <>
                {/* Tenant Admin: Primary tabs */}
                {[
                  { name: 'Recognize', href: '/recognize', icon: HiOutlineSparkles },
                  { name: 'Feed', href: '/feed', icon: HiOutlineNewspaper },
                  { name: 'Wallet', href: '/wallet', icon: HiOutlineCash },
                  { name: 'Redeem', href: '/redeem', icon: HiOutlineGift },
                ].map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-sparknode-purple/10 text-sparknode-purple'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </NavLink>
                ))}

                {/* Admin Dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                    <HiOutlineClipboardList className="w-4 h-4" />
                    Admin
                    <HiOutlineChevronDown className="w-4 h-4" />
                  </button>
                  <div className="absolute left-0 mt-0 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <NavLink
                      to="/budgets"
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-sparknode-purple/10 text-sparknode-purple'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`
                      }
                    >
                      <HiOutlineChartBar className="w-4 h-4" />
                      Budgets
                    </NavLink>
                    <NavLink
                      to="/users"
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-sparknode-purple/10 text-sparknode-purple'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`
                      }
                    >
                      <HiOutlineUsers className="w-4 h-4" />
                      Users
                    </NavLink>
                    <NavLink
                      to="/audit"
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-sparknode-purple/10 text-sparknode-purple'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`
                      }
                    >
                      <HiOutlineClipboardList className="w-4 h-4" />
                      Audit
                    </NavLink>
                  </div>
                </div>
              </>
            ) : !isPlatformUser ? (
              navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sparknode-purple/10 text-sparknode-purple'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </NavLink>
              ))
            ) : null}

            {adminNavigation.some((item) => canAccess(item.roles)) && effectiveRole !== 'tenant_admin' && (
              <>
                <div className="w-px h-6 bg-gray-200 mx-2" />
                {adminNavigation.map((item) =>
                  canAccess(item.roles) ? (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-sparknode-purple/10 text-sparknode-purple'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      {item.name}
                    </NavLink>
                  ) : null
                )}
              </>
            )}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <HiOutlineBell className="w-5 h-5 text-gray-600" />
              {notificationCount?.data?.unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 text-xs font-medium text-white bg-red-500 rounded-full flex items-center justify-center">
                  {notificationCount.data.unread > 9 ? '9+' : notificationCount.data.unread}
                </span>
              )}
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-sparknode-purple to-sparknode-blue flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  {getInitials()}
                </div>
                <div className="hidden sm:block text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{getDisplayName()}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {getRoleDisplayName(effectiveRole)}
                  </p>
                </div>
                <HiOutlineChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 hidden sm:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 animate-in fade-in zoom-in-95 origin-top-right">
                  {/* Menu Items */}
                  <div className="p-1 space-y-0.5">
                    <NavLink
                      to="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <HiOutlineUser className="w-4 h-4" />
                      Profile
                    </NavLink>

                    {/* Switch Persona / Persona Manager */}
                    <div className="border-t border-gray-100 my-1 pt-1">
                      <button
                        onClick={() => setPersonaExpandOpen(!personaExpandOpen)}
                        className="w-full text-left px-3 py-1 mb-0.5 flex items-center justify-between"
                      >
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Switch Persona
                        </p>
                        <HiOutlineChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${personaExpandOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {personaExpandOpen && (
                        <div className="space-y-0.5">
                          {[
                            { value: 'tenant_admin', label: 'Tenant Admin' },
                            { value: 'tenant_lead', label: 'Tenant Leader' },
                            { value: 'corporate_user', label: 'Corporate User' },
                          ].map((persona) => (
                            <button
                              key={persona.value}
                              onClick={() => {
                                setPersonaRole(persona.value)
                                setProfileOpen(false)
                                setPersonaExpandOpen(false)
                              }}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                effectiveRole === persona.value
                                  ? 'bg-sparknode-purple text-white'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {persona.label}
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              clearPersonaRole()
                              setProfileOpen(false)
                              setPersonaExpandOpen(false)
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              effectiveRole === 'corporate_user' || (effectiveRole && !['tenant_admin', 'tenant_lead', 'corporate_user'].includes(effectiveRole))
                                ? 'bg-sparknode-purple text-white'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            Platform Admin
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        handleLogout()
                        setProfileOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <HiOutlineLogout className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileNavOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-gray-50 px-4 sm:px-6 py-4 space-y-2 max-h-96 overflow-y-auto">
          {!isPlatformUser && navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sparknode-purple text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </NavLink>
          ))}

          {adminNavigation.some((item) => canAccess(item.roles)) && (
            <>
              <div className="my-2 border-t border-gray-200 pt-2">
                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Admin
                </p>
              </div>
              {adminNavigation.map((item) =>
                canAccess(item.roles) ? (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-sparknode-purple text-white'
                          : 'text-gray-700 hover:bg-gray-200'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </NavLink>
                ) : null
              )}
            </>
          )}
        </div>
      )}
    </header>
    </>
  )
}
