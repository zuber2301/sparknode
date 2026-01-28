import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Feed from './pages/Feed'
import Recognize from './pages/Recognize'
import Redeem from './pages/Redeem'
import Wallet from './pages/Wallet'
import Budgets from './pages/Budgets'
import Users from './pages/Users'
import Audit from './pages/Audit'
import Profile from './pages/Profile'
import PlatformTenants from './pages/PlatformTenants'

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
        <Route path="feed" element={<Feed />} />
        <Route path="recognize" element={<Recognize />} />
        <Route path="redeem" element={<Redeem />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="budgets" element={<Budgets />} />
        <Route path="users" element={<Users />} />
        <Route path="audit" element={<Audit />} />
        <Route path="profile" element={<Profile />} />
        <Route path="platform/tenants" element={<PlatformTenants />} />
      </Route>
    </Routes>
  )
}

export default App
