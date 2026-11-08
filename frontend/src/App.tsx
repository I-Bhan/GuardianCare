import { BrowserRouter, Routes, Route, Outlet, NavLink } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './hooks/useAuth'
import WorkspaceAccount from './components/WorkspaceAccount'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import About from './pages/About'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

function AccountLayout() {
  return <div className="auth-layout">
    <aside className="auth-intro"><img className="account-wordmark" src="/guardiancare-wordmark.png" alt="GuardianCare" width={237} height={69} /><p>Patient monitoring, vital signs, and incident history in one care workspace.</p></aside>
    <Outlet />
  </div>
}

function WorkspaceLayout() {
  const { role } = useAuth()
  return <div className="workspace">
    <aside aria-label="Workspace navigation"><p>Care workspace</p><NavLink to="/dashboard">Dashboard</NavLink>{role === 'admin' && <NavLink to="/admin">Administration</NavLink>}<WorkspaceAccount /></aside>
    <Outlet />
  </div>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route element={<AccountLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              </Route>
              <Route path="/about" element={<About />} />
              <Route element={<WorkspaceLayout />}>
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              </Route>
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
