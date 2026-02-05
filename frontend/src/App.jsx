import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import Feed from './pages/Feed'
import Recognize from './pages/Recognize'
import Redeem from './pages/Redeem'
import Wallet from './pages/Wallet'
import Budgets from './pages/Budgets'
import Users from './pages/Users'
import Audit from './pages/Audit'
import Profile from './pages/Profile'
import UserProfile from './pages/UserProfile'
import SpendAnalysis from './pages/SpendAnalysis'
import PlatformTenants from './pages/PlatformTenants'
import PlatformTenantDetail from './pages/PlatformTenantDetail'
import PlatformTenantUsers from './pages/PlatformTenantUsers'
import TenantDashboard from './pages/TenantDashboard'
import Events from './pages/Events'
import EventCreateWizard from './pages/EventCreateWizard'
import EventDetail from './pages/EventDetail'
import EmployeeEvents from './pages/EmployeeEvents'
import Marketplace from './pages/Marketplace'
import AISettings from './pages/AISettings'
import Templates from './pages/Templates'
import Billing from './pages/Billing'
import TeamHub from './pages/TeamHub'
import TeamDistribute from './pages/TeamDistribute'
import TeamActivity from './pages/TeamActivity'
import TeamApprovals from './pages/TeamApprovals'
import TeamAnalytics from './pages/TeamAnalytics'
import InviteUsers from './pages/admin/InviteUsers'
import PlatformAdminBudgetLedgerPage from './pages/PlatformAdminBudgetLedgerPage'
import Departments from './pages/Departments'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import { useParams } from 'react-router-dom'

function EventCreateWizardEdit() {
  const { eventId } = useParams()
  return <EventCreateWizard editingEventId={eventId} />
}

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" />
}

function AdminRoute({ children }) {
  const { isAuthenticated, user, getEffectiveRole } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" />
  
  const effectiveRole = getEffectiveRole()
  const isAdmin = effectiveRole === 'tenant_manager' || 
                  effectiveRole === 'hr_admin' ||
                  effectiveRole === 'platform_admin'
  
  return isAdmin ? children : <Navigate to="/dashboard" />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="admin-dashboard" element={<AdminDashboard />} />
        <Route path="feed" element={<Feed />} />
        <Route path="recognize" element={<Recognize />} />
        <Route path="redeem" element={<Redeem />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="events/browse" element={<EmployeeEvents />} />
        <Route path="budgets" element={<Budgets />} />
        <Route path="spend-analysis" element={<SpendAnalysis />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:userId" element={<UserProfile />} />
        <Route path="audit" element={<Audit />} />
        <Route path="profile" element={<Profile />} />
        <Route path="events" element={<Events />} />
        <Route path="events/create" element={<EventCreateWizard />} />
        <Route path="events/:eventId" element={<EventDetail />} />
        <Route path="events/:eventId/edit" element={<EventCreateWizardEdit />} />
        <Route path="platform/tenants" element={<PlatformTenants />} />
        <Route path="platform/tenants/:tenantId" element={<PlatformTenantDetail />} />
        <Route path="platform/tenants/:tenantId/users" element={<PlatformTenantUsers />} />
        <Route path="platform/budget-ledger" element={
          <AdminRoute>
            <PlatformAdminBudgetLedgerPage />
          </AdminRoute>
        } />
        <Route path="tenant/:slug" element={<TenantDashboard />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="departments" element={<Departments />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="ai-settings" element={<AISettings />} />
        <Route path="templates" element={<Templates />} />
        <Route path="billing" element={<Billing />} />
        <Route path="team" element={<TeamHub />} />
        <Route path="team/distribute" element={<TeamDistribute />} />
        <Route path="team/activity" element={<TeamActivity />} />
        <Route path="team/approvals" element={<TeamApprovals />} />
        <Route path="team/analytics" element={<TeamAnalytics />} />
        <Route path="admin/invite-users" element={
          <AdminRoute>
            <InviteUsers />
          </AdminRoute>
        } />
      </Route>
    </Routes>
  )
}

export default App
