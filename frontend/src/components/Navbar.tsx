import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Shield, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
]

export default function Navbar() {
  const { user, profile, role, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="bg-navy text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
            <Shield className="text-sage" size={24} />
            <span>Guardian<span className="text-sage">Care</span></span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm font-medium transition-colors duration-200 ${
                  isActive(to) ? 'text-sage' : 'text-slate hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}

            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className={`text-sm font-medium transition-colors duration-200 ${
                    isActive('/dashboard') ? 'text-sage' : 'text-slate hover:text-white'
                  }`}
                >
                  Dashboard
                </Link>
                {role === 'admin' && (
                  <Link
                    to="/admin"
                    className={`text-sm font-medium transition-colors duration-200 ${
                      isActive('/admin') ? 'text-sage' : 'text-slate hover:text-white'
                    }`}
                  >
                    Admin
                  </Link>
                )}
                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate/30">
                  <span className="text-xs text-slate">
                    {profile?.full_name ?? 'User'}
                    <span className="ml-1 bg-sage/20 text-sage text-[10px] px-1.5 py-0.5 rounded-full uppercase">
                      {profile?.role}
                    </span>
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1 text-sm text-slate hover:text-white transition-colors"
                  >
                    <LogOut size={15} />
                  </button>
                </div>
              </>
            ) : (
              <Link to="/login" className="btn-primary text-sm">
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-slate hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-navy border-t border-slate/20 px-4 py-4 space-y-3">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={`block text-sm font-medium ${
                isActive(to) ? 'text-sage' : 'text-slate'
              }`}
            >
              {label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="block text-sm font-medium text-slate"
              >
                Dashboard
              </Link>
              {role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="block text-sm font-medium text-slate"
                >
                  Admin
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-sm text-slate"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </>
          ) : (
            <Link to="/login" onClick={() => setMenuOpen(false)} className="block btn-primary text-center text-sm">
              Sign In
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
