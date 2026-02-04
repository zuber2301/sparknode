/**
 * Budget Ledger Routes
 * Navigation routing for Budget Ledger views
 * 
 * Integrates into existing React Router structure
 */

import React, { Suspense } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// Lazy load components for better performance
const PlatformAdminLedger = React.lazy(() =>
  import('../components/ledger/PointsLedger').then(m => ({ default: m.PlatformAdminLedger }))
)
const TenantManagerLedger = React.lazy(() =>
  import('../components/ledger/PointsLedger').then(m => ({ default: m.TenantManagerLedger }))
)
const EmployeeWalletLedger = React.lazy(() =>
  import('../components/ledger/PointsLedger').then(m => ({ default: m.EmployeeWalletLedger }))
)

/**
 * Loading placeholder while components load
 */
function LedgerLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
        </div>
        <p className="mt-4 text-gray-600">Loading ledger...</p>
      </div>
    </div>
  )
}

/**
 * Route configuration for ledger views
 * Add these to your main router in App.jsx or Router.jsx
 */
export const ledgerRoutes = [
  {
    path: 'ledger',
    children: [
      // Platform Admin Routes
      {
        path: 'allocations',
        element: (
          <Suspense fallback={<LedgerLoading />}>
            <PlatformAdminLedger />
          </Suspense>
        ),
        requiredRole: 'platform_admin',
        title: 'Budget Allocation Ledger'
      },

      // Tenant Manager Routes
      {
        path: 'distributions',
        element: (
          <Suspense fallback={<LedgerLoading />}>
            <TenantManagerLedger />
          </Suspense>
        ),
        requiredRole: 'tenant_manager',
        title: 'Budget Distribution History'
      },

      // Employee Routes
      {
        path: 'wallet',
        element: (
          <Suspense fallback={<LedgerLoading />}>
            <EmployeeWalletLedger />
          </Suspense>
        ),
        requiredRole: 'employee',
        title: 'My Budget Wallet'
      },

      // Redirect unknown ledger routes
      {
        path: '*',
        element: <Navigate to="wallet" replace />
      }
    ]
  }
]

/**
 * Route guard component
 * Checks if user has required role to access ledger
 */
export function LedgerRouteGuard({ requiredRole, children }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Map user org_role to our permission system
  const userRole = user.org_role?.toLowerCase() || ''
  const canAccess =
    (requiredRole === 'platform_admin' && userRole === 'admin') ||
    (requiredRole === 'tenant_manager' && ['manager', 'lead'].includes(userRole)) ||
    (requiredRole === 'employee' && ['employee', 'manager', 'lead', 'admin'].includes(userRole))

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

/**
 * Navigation items for side menu/navigation bar
 * Conditionally rendered based on user role
 */
export function getLedgerNavItems(userRole) {
  const role = userRole?.toLowerCase() || ''

  const items = []

  // Platform Admin items
  if (role === 'admin') {
    items.push({
      id: 'allocations-ledger',
      label: 'Points Allocations',
      path: '/ledger/allocations',
      icon: 'HiChartBar',
      description: 'View allocation history and billing'
    })
  }

  // Tenant Manager items
  if (['manager', 'lead'].includes(role)) {
    items.push({
      id: 'distributions-ledger',
      label: 'Distribution History',
      path: '/ledger/distributions',
      icon: 'HiArrowsExpand',
      description: 'View point distributions within your team'
    })
  }

  // All authenticated users
  if (role) {
    items.push({
      id: 'wallet-ledger',
      label: 'My Points Wallet',
      path: '/ledger/wallet',
      icon: 'HiCreditCard',
      description: 'View your personal points balance and history'
    })
  }

  return items
}

/**
 * Integration instructions for App.jsx or Router.jsx
 * 
 * 1. Import the ledgerRoutes:
 *    import { ledgerRoutes } from './routes/ledgerRoutes'
 * 
 * 2. Add to your router configuration:
 *    {
 *      path: 'app',
 *      element: <ProtectedLayout />,
 *      children: [
 *        ...ledgerRoutes,
 *        // ... other routes
 *      ]
 *    }
 * 
 * 3. Add navigation items to your sidebar/menu:
 *    const navItems = getLedgerNavItems(user.org_role)
 *    // Render navItems in your navigation component
 * 
 * 4. Wrap specific routes with LedgerRouteGuard if needed:
 *    <LedgerRouteGuard requiredRole="platform_admin">
 *      <PlatformAdminLedger />
 *    </LedgerRouteGuard>
 */

export default {
  ledgerRoutes,
  LedgerRouteGuard,
  getLedgerNavItems,
  LedgerLoading
}
