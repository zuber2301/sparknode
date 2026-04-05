import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/DashboardRouter'
import AdminDashboard from './pages/AdminDashboard'
import Feed from './pages/Feed'
import Recognize from './pages/Recognize'
import Redeem from './pages/Redeem'
import Wallet from './pages/Wallet'
import Budgets from './pages/Budgets'
import BudgetWorkflow from './pages/BudgetWorkflow'
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
import SalesEvents from './pages/SalesEvents'
import SalesEventRegistration from './pages/SalesEventRegistration'
import CampaignBuilder from './pages/CampaignBuilder'
import GrowthEvents from './pages/GrowthEvents'
import EscrowApproval from './pages/EscrowApproval'
import ExhibitionMode from './pages/ExhibitionMode'
import Templates from './pages/Templates'
import Billing from './pages/Billing'
import TeamHub from './pages/TeamHub'
import TeamDistribute from './pages/TeamDistribute'
import TenantDistributeWorkflow from './pages/TenantDistributeWorkflow'
import TeamActivity from './pages/TeamActivity'
import TeamApprovals from './pages/TeamApprovals'
import TeamAnalytics from './pages/TeamAnalytics'
import InviteUsers from './pages/admin/InviteUsers'
import PlatformAdminBudgetLedgerPage from './pages/PlatformAdminBudgetLedgerPage'
import PlatformCatalog from './pages/PlatformCatalog'
import TenantCatalog from './pages/TenantCatalog'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Challenges from './pages/Challenges'
import CompanyValues from './pages/CompanyValues'
import LandingPage from './pages/LandingPage'
import Gateway from './pages/Gateway'
import SparkNodeLanding from './pages/SparkNodeLanding'
import IgniteNodeLanding from './pages/IgniteNodeLanding'
import Pricing from './pages/Pricing'
import EngagementDashboard from './pages/EngagementDashboard'
import GrowthEventRegistrationPage from './pages/GrowthEventRegistrationPage'
import Onboarding from './pages/Onboarding'
import { ExperienceProvider } from './context/ExperienceContext'
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
                  effectiveRole === 'platform_admin'
  
  return isAdmin ? children : <Navigate to="/dashboard" />
}

/**
 * TenantManagerRoute - Only visible to tenant_manager (not dept_lead or above)
 * Used for pages that are ONLY for tenant manager, not for platform admin
 */
function TenantManagerRoute({ children }) {
  const { isAuthenticated, getEffectiveRole } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" />
  
  const effectiveRole = getEffectiveRole()
  const isTenantManager = effectiveRole === 'tenant_manager'
  
  return isTenantManager ? children : <Navigate to="/dashboard" />
}

/**
 * NonUserRoute - Blocks regular tenant_user role; accessible to dept_lead and above.
 * Used for Feed, Events management, and other pages users should not access.
 */
function NonUserRoute({ children }) {
  const { isAuthenticated, getEffectiveRole } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" />

  const effectiveRole = getEffectiveRole()
  const isRegularUser = effectiveRole === 'tenant_user'

  return isRegularUser ? <Navigate to="/dashboard" /> : children
}

/**
 * ManagerRoute - Visible to dept_lead and above (includes tenant_manager & platform_admin)
 * Used for pages accessible to managers
 */
function ManagerRoute({ children }) {
  const { isAuthenticated, getEffectiveRole } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" />
  
  const effectiveRole = getEffectiveRole()
  const isManager = ['tenant_manager', 'dept_lead', 'platform_admin'].includes(effectiveRole)
  
  return isManager ? children : <Navigate to="/dashboard" />
}

/**
 * PlatformAdminRoute - Only visible to platform_admin
 * Used for platform-wide admin pages
 */
function PlatformAdminRoute({ children }) {
  const { isAuthenticated, isPlatformOwnerUser } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" />
  
  const isPlatformUser = isPlatformOwnerUser()
  
  return isPlatformUser ? children : <Navigate to="/dashboard" />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/e/:slug" element={<GrowthEventRegistrationPage />} />

      {/* Standalone Launchpad — full-screen, no Layout chrome */}
      <Route path="/gateway" element={
        <PrivateRoute>
          <ExperienceProvider>
            <Gateway />
          </ExperienceProvider>
        </PrivateRoute>
      } />

      <Route path="/" element={
        <PrivateRoute>
          <ExperienceProvider>
            <Layout />
          </ExperienceProvider>
        </PrivateRoute>
      }>
        <Route index element={<LandingPage />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="sparknode" element={<SparkNodeLanding />} />
        <Route path="ignitenode" element={<IgniteNodeLanding />} />
        <Route path="admin-dashboard" element={<AdminDashboard />} />
        <Route path="feed" element={
          <PrivateRoute>
            <Feed />
          </PrivateRoute>
        } />
        <Route path="recognize" element={<Recognize />} />
        <Route path="redeem" element={<Redeem />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="challenges" element={<PrivateRoute><Challenges /></PrivateRoute>} />
        <Route path="events/browse" element={<EmployeeEvents />} />
        
        {/* Admin Pages - Only Tenant Manager & Platform Admin */}
        <Route path="budgets" element={
          <AdminRoute>
            <Budgets />
          </AdminRoute>
        } />
        <Route path="budget-workflow" element={
          <AdminRoute>
            <BudgetWorkflow />
          </AdminRoute>
        } />
        <Route path="users" element={
          <AdminRoute>
            <Users />
          </AdminRoute>
        } />
        <Route path="users/:userId" element={
          <AdminRoute>
            <UserProfile />
          </AdminRoute>
        } />
        <Route path="audit" element={
          <AdminRoute>
            <Audit />
          </AdminRoute>
        } />
        
        {/* Profile & Settings */}
        <Route path="profile" element={<Profile />} />
        
        {/* Event Management - restricted to tenant managers only */}
        <Route path="events" element={
          <TenantManagerRoute>
            <Events />
          </TenantManagerRoute>
        } />
        <Route path="events/create" element={
          <TenantManagerRoute>
            <EventCreateWizard />
          </TenantManagerRoute>
        } />
        <Route path="events/:eventId" element={
          <TenantManagerRoute>
            <EventDetail />
          </TenantManagerRoute>
        } />
        <Route path="events/:eventId/edit" element={
          <TenantManagerRoute>
            <EventCreateWizardEdit />
          </TenantManagerRoute>
        } />
        {/* IgniteNode — Sales Events, Campaigns, Growth Events */}
        <Route path="sales-events" element={<SalesEvents />} />
        <Route path="e/sales/:eventId" element={<SalesEventRegistration />} />
        <Route path="growth-events" element={<GrowthEvents />} />

        {/* Sales Campaigns — Exhibition / Booth */}
        <Route path="campaigns" element={<CampaignBuilder />} />
        <Route path="campaigns/:campaignId/booth" element={<ExhibitionMode />} />
        <Route path="campaigns/escrow" element={
          <AdminRoute>
            <EscrowApproval />
          </AdminRoute>
        } />
        
        {/* Analytics - Different availability based on role */}
        <Route path="analytics" element={
          <ManagerRoute>
            <Analytics />
          </ManagerRoute>
        } />
        <Route path="spend-analysis" element={
          <AdminRoute>
            <SpendAnalysis />
          </AdminRoute>
        } />
        
        {/* Settings - Platform Admin Only */}
        <Route path="settings" element={
          <PlatformAdminRoute>
            <Settings />
          </PlatformAdminRoute>
        } />
        <Route path="company-values" element={
          <TenantManagerRoute>
            <CompanyValues />
          </TenantManagerRoute>
        } />
        
        {/* Platform Admin Only */}
        <Route path="platform/tenants" element={
          <PlatformAdminRoute>
            <PlatformTenants />
          </PlatformAdminRoute>
        } />
        {/* Legacy/shortcut route: redirect /tenants to platform tenant management */}
        <Route path="tenants" element={<Navigate to="/platform/tenants" />} />
        <Route path="platform/tenants/:tenantId" element={
          <PlatformAdminRoute>
            <PlatformTenantDetail />
          </PlatformAdminRoute>
        } />
        <Route path="platform/tenants/:tenantId/users" element={
          <PlatformAdminRoute>
            <PlatformTenantUsers />
          </PlatformAdminRoute>
        } />
        <Route path="platform/budget-ledger" element={
          <PlatformAdminRoute>
            <PlatformAdminBudgetLedgerPage />
          </PlatformAdminRoute>
        } />
        <Route path="platform/catalog" element={
          <PlatformAdminRoute>
            <PlatformCatalog />
          </PlatformAdminRoute>
        } />
        
        {/* Platform Admin Controls */}
        <Route path="marketplace" element={
          <AdminRoute>
            <Marketplace />
          </AdminRoute>
        } />
        <Route path="catalog" element={
          <AdminRoute>
            <TenantCatalog />
          </AdminRoute>
        } />
        <Route path="ai-settings" element={
          <PlatformAdminRoute>
            <AISettings />
          </PlatformAdminRoute>
        } />
        <Route path="templates" element={
          <PlatformAdminRoute>
            <Templates />
          </PlatformAdminRoute>
        } />
        <Route path="billing" element={
          <PlatformAdminRoute>
            <Billing />
          </PlatformAdminRoute>
        } />
        
        {/* Team Management - Department Lead & Above */}
        <Route path="team-hub" element={
          <ManagerRoute>
            <TeamHub />
          </ManagerRoute>
        } />
        <Route path="team/distribute" element={
          <ManagerRoute>
            <TeamDistribute />
          </ManagerRoute>
        } />
        <Route path="team/activity" element={
          <ManagerRoute>
            <TeamActivity />
          </ManagerRoute>
        } />
        <Route path="team/approvals" element={
          <ManagerRoute>
            <TeamApprovals />
          </ManagerRoute>
        } />
        <Route path="team/analytics" element={
          <ManagerRoute>
            <TeamAnalytics />
          </ManagerRoute>
        } />
        
        {/* Alternative Team Routes for backward compatibility */}
        <Route path="team" element={
          <ManagerRoute>
            <TeamHub />
          </ManagerRoute>
        } />
        <Route path="team-distribute" element={
          <ManagerRoute>
            <TeamDistribute />
          </ManagerRoute>
        } />
        
        {/* Budget Distribution - Tenant Manager Only */}
        <Route path="budget/distribute" element={
          <TenantManagerRoute>
            <TenantDistributeWorkflow />
          </TenantManagerRoute>
        } />

        {/* Admin Invite Users - Tenant Manager Only */}
        <Route path="admin/invite-users" element={
          <TenantManagerRoute>
            <InviteUsers />
          </TenantManagerRoute>
        } />
        
        {/* Engagement Dashboard - Tenant Manager Only */}
        <Route path="engagement" element={
          <TenantManagerRoute>
            <EngagementDashboard />
          </TenantManagerRoute>
        } />

        {/* Legacy Routes */}
        <Route path="tenant/:slug" element={<TenantDashboard />} />
      </Route>
    </Routes>
  )
}

export default App
