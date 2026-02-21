import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useQuery, useMutation } from '@tanstack/react-query'
import { notificationsAPI, platformAPI, tenantsAPI, authAPI } from '../lib/api'
import toast from 'react-hot-toast'
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
  HiOutlineCalendar,
  HiOutlineCog as HiOutlineSettings,
} from 'react-icons/hi'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HiOutlineHome },
  { name: 'Event Management', href: '/events/browse', icon: HiOutlineNewspaper },
  { name: 'Sales Events', href: '/sales-events', icon: HiOutlineCalendar, featureFlag: true },
  { name: 'Feed', href: '/feed', icon: HiOutlineNewspaper },
  { name: 'Recognize', href: '/recognize', icon: HiOutlineSparkles },
  { name: 'Redeem', href: '/redeem', icon: HiOutlineGift },
  { name: 'Wallet', href: '/wallet', icon: HiOutlineCash },
]

const adminNavigation = [
  { name: 'Tenants', href: '/platform/tenants', icon: HiOutlineOfficeBuilding, roles: ['platform_admin'] },
  { name: 'Budgets', href: '/budgets', icon: HiOutlineChartBar, roles: ['tenant_manager', 'platform_admin'] },
  { name: 'Users', href: '/users', icon: HiOutlineUsers, roles: ['tenant_manager', 'platform_admin'] },
  { name: 'Invite Users', href: '/admin/invite-users', icon: HiOutlineMailOpen, roles: ['tenant_manager'] },
  { name: 'Audit Log', href: '/audit', icon: HiOutlineClipboardList, roles: ['tenant_manager', 'platform_admin'] },
  { name: 'Marketplace', href: '/marketplace', icon: HiOutlineShoppingCart, roles: ['platform_admin'] },
  { name: 'AI Settings', href: '/ai-settings', icon: HiOutlineCog, roles: ['platform_admin'] },
  { name: 'Templates', href: '/templates', icon: HiOutlineViewGrid, roles: ['platform_admin'] },
  { name: 'Billing', href: '/billing', icon: HiOutlineCreditCard, roles: ['platform_admin'] },
]

// Platform Admin specific navigation - displayed in top nav with Controls dropdown
const platformAdminNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HiOutlineHome },
  { name: 'Tenants', href: '/platform/tenants', icon: HiOutlineOfficeBuilding },
  { name: 'Users', href: '/users', icon: HiOutlineUsers },
  { name: 'Budgets', href: '/budgets', icon: HiOutlineChartBar },
  { name: 'Event Management', href: '/events', icon: HiOutlineNewspaper },
  { name: 'Marketplace', href: '/marketplace', icon: HiOutlineShoppingCart },
  {
    name: 'Controls',
    icon: HiOutlineSettings,
    submenu: [
      { name: 'Settings', href: '/settings', icon: HiOutlineCog },
      { name: 'AI Settings', href: '/ai-settings', icon: HiOutlineCog },
      { name: 'Templates', href: '/templates', icon: HiOutlineViewGrid },
      { name: 'Billing', href: '/billing', icon: HiOutlineCreditCard },
      { name: 'Audit Log', href: '/audit', icon: HiOutlineClipboardList },
    ],
  },
]

// Tenant Manager specific navigation - "Nerve Center"
const tenantManagerNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HiOutlineHome },
  { name: 'Event Management', href: '/events', icon: HiOutlineNewspaper },
  { name: 'Sales Events', href: '/sales-events', icon: HiOutlineCalendar, featureFlag: true },
  { name: 'User Management', href: '/users', icon: HiOutlineUsers },
  { name: 'Marketplace & Rewards', href: '/marketplace', icon: HiOutlineShoppingCart },
  { name: 'Analytics & Reports', href: '/analytics', icon: HiOutlineChartBar },
]

// Tenant Lead specific navigation
const tenantLeadNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HiOutlineHome },
  { name: 'Event Management', href: '/events/browse', icon: HiOutlineNewspaper },
  { name: 'Sales Events', href: '/sales-events', icon: HiOutlineCalendar, featureFlag: true },
  { name: 'Recognize', href: '/recognize', icon: HiOutlineSparkles },
  { name: 'Redeem', href: '/redeem', icon: HiOutlineGift },
  { name: 'Wallet', href: '/wallet', icon: HiOutlineCash },
  { name: 'Analytics & Reports', href: '/analytics', icon: HiOutlineChartBar },
]

// Regular user navigation — limited to core actions only
const userNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HiOutlineHome },
  { name: 'Recognize', href: '/recognize', icon: HiOutlineSparkles },
  { name: 'Redeem', href: '/redeem', icon: HiOutlineGift },
  { name: 'Wallet', href: '/wallet', icon: HiOutlineCash },
  { name: 'Events', href: '/events/browse', icon: HiOutlineCalendar },
]

export default function TopHeader() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [tenantSelectorOpen, setTenantSelectorOpen] = useState(false)
  const [controlsDropdownOpen, setControlsDropdownOpen] = useState(false)
  const [tenantSearch, setTenantSearch] = useState('')
  const profileRef = useRef(null)

  const {
    user,
    logout,
    updateTenantContext,
    tenantContext,
    getEffectiveRole,
    getTenantId,
    getTenantName,
    isPlatformOwnerUser,
    isPlatformOwner,
    updateUser,
    setAuth,
    getAvailableRoles,
    switchRole,
    getCurrentRole,
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
        // Ensure auth store has full user/roles state populated.
        // If the persisted store already has a token, preserve it.
        const token = useAuthStore.getState().token
        setAuth(response.data, token)
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
    onSuccess: (response) => {
      if (response?.data?.feature_flags && !tenantContext?.feature_flags) {
        updateTenantContext({ feature_flags: response.data.feature_flags })
      }
    },
  })

  const salesEnabled = (() => {
    const flags = (tenantContext && tenantContext.feature_flags) || (currentTenantResponse && currentTenantResponse.data && currentTenantResponse.data.feature_flags) || {}
    return !!(flags.sales_marketing || flags.sales_marketting_enabled)
  })()

  // Check if user has sales_marketing role for menu access
  const hasSalesRole = user?.org_role === 'sales_marketing'

  // Tenant display helpers
  const tenantName = getTenantName ? getTenantName() : tenantContext?.tenant_name || user?.tenant_name
  const tenantIdShort = (getTenantId ? getTenantId() : tenantContext?.tenant_id || user?.tenant_id)?.split('-')?.[0]

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
      tenant_manager: 'Tenant Manager',
      dept_lead: 'Department Lead',
      tenant_user: 'User',
      sales_marketing: 'Sales & Marketing',
      ai_copilot: 'AI Assistant',
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

  // Switch role mutation
  const switchRoleMutation = useMutation({
    mutationFn: (newRole) => authAPI.switchRole(newRole),
    onSuccess: (response) => {
      const { access_token, current_role, available_roles } = response.data
      
      // Update the token in store and local storage
      const { updateToken } = useAuthStore.getState()
      updateToken(access_token)
      localStorage.setItem('token', access_token)
      
      // Update the auth store with new role
      switchRole(current_role)
      
      // Show success message
      toast.success(`Switched to ${current_role.replace(/_/g, ' ').toUpperCase()} role`)
      
      // Reload the page to reflect role changes in navigation
      setTimeout(() => {
        window.location.reload()
      }, 500)
    },
    onError: (error) => {
      const message = error.response?.data?.detail || 'Failed to switch role'
      toast.error(message)
    }
  })

  const handleSwitchRole = async (newRole) => {
    switchRoleMutation.mutate(newRole)
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
            {effectiveRole === 'platform_admin' ? (
              <>
                {/* Platform Admin: Custom navigation with Controls dropdown */}
                {platformAdminNavigation.map((item) => {
                  if (item.submenu) {
                    // Render Controls dropdown
                    return (
                      <div key={item.name} className="relative group">
                        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200">
                          <item.icon className="w-4 h-4" />
                          {item.name}
                          <HiOutlineChevronDown className="w-3.5 h-3.5 opacity-60" />
                        </button>
                        <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-1">
                          {item.submenu.map((subitem) => (
                            <NavLink
                              key={subitem.name}
                              to={subitem.href}
                              className={({ isActive }) =>
                                `flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                                  isActive
                                    ? 'bg-sparknode-purple/10 text-sparknode-purple font-semibold'
                                    : 'text-gray-700 hover:bg-gray-50 font-medium'
                                }`
                              }
                            >
                              <subitem.icon className="w-4 h-4" />
                              {subitem.name}
                            </NavLink>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                          isActive
                            ? 'bg-sparknode-purple text-white font-semibold shadow-sm'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {item.name}
                    </NavLink>
                  )
                })}
              </>
            ) : !isPlatformUser && effectiveRole === 'tenant_manager' ? (
              <>
                {/* Tenant Manager: Nerve Center tabs */}
                {tenantManagerNavigation.filter(item => !item.featureFlag || salesEnabled || hasSalesRole).map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-sparknode-purple text-white font-semibold shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {item.name}
                  </NavLink>
                ))}

                {/* Admin Dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200">
                    <HiOutlineClipboardList className="w-4 h-4" />
                    Admin
                    <HiOutlineChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>
                  <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-1">
                    <NavLink
                      to="/budgets"
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-sparknode-purple/10 text-sparknode-purple font-semibold'
                            : 'text-gray-700 hover:bg-gray-50 font-medium'
                        }`
                      }
                    >
                      <HiOutlineChartBar className="w-4 h-4" />
                      Budgets
                    </NavLink>
                    <NavLink
                      to="/users"
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-sparknode-purple/10 text-sparknode-purple font-semibold'
                            : 'text-gray-700 hover:bg-gray-50 font-medium'
                        }`
                      }
                    >
                      <HiOutlineUsers className="w-4 h-4" />
                      Users
                    </NavLink>
                    <NavLink
                      to="/audit"
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-sparknode-purple/10 text-sparknode-purple font-semibold'
                            : 'text-gray-700 hover:bg-gray-50 font-medium'
                        }`
                      }
                    >
                      <HiOutlineClipboardList className="w-4 h-4" />
                      Audit
                    </NavLink>
                  </div>
                </div>
              </>
            ) : !isPlatformUser && effectiveRole === 'dept_lead' ? (
              <>
                {/* Tenant Lead: Browse tabs */}
                {tenantLeadNavigation.filter(item => !item.featureFlag || salesEnabled || hasSalesRole).map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-sparknode-purple text-white font-semibold shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {item.name}
                  </NavLink>
                ))}

                {/* Admin Dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200">
                    <HiOutlineClipboardList className="w-4 h-4" />
                    Admin
                    <HiOutlineChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>
                  <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-1">
                    <NavLink
                      to="/budgets"
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-sparknode-purple/10 text-sparknode-purple font-semibold'
                            : 'text-gray-700 hover:bg-gray-50 font-medium'
                        }`
                      }
                    >
                      <HiOutlineChartBar className="w-4 h-4" />
                      Budgets
                    </NavLink>
                    <NavLink
                      to="/users"
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-sparknode-purple/10 text-sparknode-purple font-semibold'
                            : 'text-gray-700 hover:bg-gray-50 font-medium'
                        }`
                      }
                    >
                      <HiOutlineUsers className="w-4 h-4" />
                      Users
                    </NavLink>
                    <NavLink
                      to="/audit"
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-sparknode-purple/10 text-sparknode-purple font-semibold'
                            : 'text-gray-700 hover:bg-gray-50 font-medium'
                        }`
                      }
                    >
                      <HiOutlineClipboardList className="w-4 h-4" />
                      Audit
                    </NavLink>
                  </div>
                </div>
              </>
            ) : effectiveRole === 'tenant_user' ? (
              // Regular user — restricted nav: Recognize, Redeem, Wallet, Events (browse only)
              userNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive
                        ? 'bg-sparknode-purple text-white font-semibold shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.name}
                </NavLink>
              ))
            ) : (
              navigation.filter(item => !item.featureFlag || salesEnabled || hasSalesRole).map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive
                        ? 'bg-sparknode-purple text-white font-semibold shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.name}
                </NavLink>
              ))
            )}

            {adminNavigation.some((item) => canAccess(item.roles)) && effectiveRole !== 'tenant_manager' && effectiveRole !== 'dept_lead' && effectiveRole !== 'platform_admin' && (
              <>
                <div className="w-px h-6 bg-gray-200 mx-2" />
                {adminNavigation.map((item) =>
                  canAccess(item.roles) ? (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                          isActive
                            ? 'bg-sparknode-purple text-white font-semibold shadow-sm'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
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

                    {/* Switch Role Option - Only show if user has multiple roles */}
                    {getAvailableRoles && getAvailableRoles().length > 1 && (
                      <div className="border-t border-gray-100 my-1 pt-1">
                        <div className="px-3 py-2">
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Switch Role</p>
                          <div className="space-y-1">
                            {getAvailableRoles && getAvailableRoles().map((role) => (
                              <button
                                key={role}
                                onClick={() => {
                                  handleSwitchRole(role)
                                  setProfileOpen(false)
                                }}
                                disabled={switchRoleMutation.isPending}
                                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                                  getCurrentRole && getCurrentRole() === role
                                    ? 'bg-sparknode-purple/10 text-sparknode-purple font-medium'
                                    : 'text-gray-700 hover:bg-gray-50'
                                } ${switchRoleMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {role === 'tenant_user' && '👤 User'}
                                {role === 'dept_lead' && '👥 Department Lead'}
                                {role === 'tenant_manager' && '⚙️ Tenant Manager'}
                                {role === 'platform_admin' && '🔐 Platform Admin'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-gray-100 my-1 pt-1">
                      <div className="px-3 py-2">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Tenant Name</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{tenantName || '—'}</p>
                      </div>
                      <div className="px-3 py-2 border-t border-gray-100">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Tenant ID</p>
                        <p className="text-sm font-mono text-gray-700 truncate">{tenantIdShort || '—'}</p>
                      </div>
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
          {effectiveRole === 'platform_admin' ? (
            <>
              {/* Platform Admin mobile nav */}
              {platformAdminNavigation.map((item) => {
                if (item.submenu) {
                  return (
                    <div key={item.name} className="space-y-1">
                      <button
                        onClick={() => setControlsDropdownOpen(!controlsDropdownOpen)}
                        className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        <item.icon className="w-4 h-4" />
                        {item.name}
                        <HiOutlineChevronDown className={`w-4 h-4 ml-auto transition-transform ${controlsDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {controlsDropdownOpen && (
                        <div className="pl-4 space-y-1">
                          {item.submenu.map((subitem) => (
                            <NavLink
                              key={subitem.name}
                              to={subitem.href}
                              onClick={() => setMobileNavOpen(false)}
                              className={({ isActive }) =>
                                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  isActive
                                    ? 'bg-sparknode-purple text-white'
                                    : 'text-gray-700 hover:bg-gray-200'
                                }`
                              }
                            >
                              <subitem.icon className="w-4 h-4" />
                              {subitem.name}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                return (
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
                )
              })}
            </>
          ) : !isPlatformUser && effectiveRole === 'tenant_manager' ? (
            <>
              {/* Tenant Manager mobile nav */}
              {tenantManagerNavigation.filter(item => !item.featureFlag || salesEnabled || hasSalesRole).map((item) => (
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
            </>
          ) : !isPlatformUser && effectiveRole === 'dept_lead' ? (
            <>
              {/* Tenant Lead mobile nav */}
              {tenantLeadNavigation.filter(item => !item.featureFlag || salesEnabled || hasSalesRole).map((item) => (
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
            </>
          ) : effectiveRole === 'tenant_user' ? (
            // Regular user mobile nav — restricted to core actions
            userNavigation.map((item) => (
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
            ))
          ) : (
            navigation.filter(item => !item.featureFlag || salesEnabled || hasSalesRole).map((item) => (
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
            ))
          )}

          {adminNavigation.some((item) => canAccess(item.roles)) && effectiveRole !== 'tenant_manager' && effectiveRole !== 'platform_admin' && (
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
