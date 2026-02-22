import { useAuthStore } from '../store/authStore'
import { Navigate } from 'react-router-dom'
import TenantManagerDashboard from './dashboards/TenantManagerDashboard'
import DeptLeadDashboard from './dashboards/DeptLeadDashboard'
import EmployeeDashboard from './dashboards/EmployeeDashboard'

/**
 * Role-Based Dashboard Router
 * Loads completely different dashboard component based on user's current role
 * Ensures complete separation between role-specific UIs
 */
export default function Dashboard() {
  const { getEffectiveRole, isPlatformOwnerUser } = useAuthStore()
  const effectiveRole = getEffectiveRole()
  const isPlatformUser = isPlatformOwnerUser()

  // Platform admins go directly to Tenants — Dashboard is redundant
  if (isPlatformUser) {
    return <Navigate to="/platform/tenants" replace />
  }

  switch (effectiveRole) {
    case 'tenant_manager':
      return <TenantManagerDashboard />
    case 'dept_lead':
      return <DeptLeadDashboard />
    case 'tenant_user':
    default:
      return <EmployeeDashboard />
  }
}
