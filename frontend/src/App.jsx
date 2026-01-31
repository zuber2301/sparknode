import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
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
import SpendAnalysis from './pages/SpendAnalysis'
import PlatformTenants from './pages/PlatformTenants'
import Events from './pages/Events'
import EventCreateWizard from './pages/EventCreateWizard'
import EventDetail from './pages/EventDetail'
import EmployeeEvents from './pages/EmployeeEvents'
import Marketplace from './pages/Marketplace'
import AISettings from './pages/AISettings'
import Templates from './pages/Templates'
import Billing from './pages/Billing'
import { useParams } from 'react-router-dom'

function EventCreateWizardEdit() {
  const { eventId } = useParams()
  return <EventCreateWizard editingEventId={eventId} />
}

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
        <Route path="audit" element={<Audit />} />
        <Route path="profile" element={<Profile />} />
        <Route path="events" element={<Events />} />
        <Route path="events/create" element={<EventCreateWizard />} />
        <Route path="events/:eventId" element={<EventDetail />} />
        <Route path="events/:eventId/edit" element={<EventCreateWizardEdit />} />
        <Route path="platform/tenants" element={<PlatformTenants />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="ai-settings" element={<AISettings />} />
        <Route path="templates" element={<Templates />} />
        <Route path="billing" element={<Billing />} />
      </Route>
    </Routes>
  )
}

export default App
