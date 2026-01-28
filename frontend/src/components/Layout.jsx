import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { notificationsAPI } from '../lib/api'
import {
  HiOutlineHome,
  HiOutlineSparkles,
  HiOutlineGift,
  HiOutlineNewspaper,
  HiOutlineCash,
  HiOutlineChartBar,
  HiOutlineUsers,
  HiOutlineClipboardList,
  HiOutlineBell,
  HiOutlineLogout,
  HiOutlineUser,
  HiOutlineMenu,
  HiOutlineX
} from 'react-icons/hi'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HiOutlineHome },
  { name: 'Feed', href: '/feed', icon: HiOutlineNewspaper },
  { name: 'Recognize', href: '/recognize', icon: HiOutlineSparkles },
  { name: 'Redeem', href: '/redeem', icon: HiOutlineGift },
  { name: 'Wallet', href: '/wallet', icon: HiOutlineCash },
]

const adminNavigation = [
  { name: 'Budgets', href: '/budgets', icon: HiOutlineChartBar, roles: ['hr_admin', 'platform_admin'] },
  { name: 'Users', href: '/users', icon: HiOutlineUsers, roles: ['hr_admin', 'platform_admin'] },
  { name: 'Audit Log', href: '/audit', icon: HiOutlineClipboardList, roles: ['hr_admin', 'platform_admin'] },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const { data: notificationCount } = useQuery({
    queryKey: ['notificationCount'],
    queryFn: () => notificationsAPI.getCount(),
    refetchInterval: 30000,
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const canAccess = (roles) => {
    if (!roles) return true
    return roles.includes(user?.role)
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
                  {user?.role?.replace('_', ' ')}
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
            <div className="flex items-center gap-2">
              <NavLink to="/profile" className="p-2 rounded-lg hover:bg-gray-100">
                <HiOutlineUser className="w-6 h-6 text-gray-600" />
              </NavLink>
              <button 
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-red-600"
              >
                <HiOutlineLogout className="w-6 h-6" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
