import { LogOut, Moon, Sun, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ThemeButton() {
  function toggleTheme() {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('gc-theme', theme) } catch { /* Storage may be disabled. */ }
  }

  return <button type="button" className="icon-button theme-button" aria-label="Toggle light or dark mode" title="Toggle light or dark mode" onClick={toggleTheme}>
    <Sun className="theme-sun" size={17} /><Moon className="theme-moon" size={17} />
  </button>
}

export default function WorkspaceAccount() {
  const { user, profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  if (!user) return null
  const name = profile?.full_name?.trim()
  return <section className="workspace-account" aria-label="Account information">
    <div className="account-heading"><UserRound size={18} aria-hidden="true" /><span>My account</span><ThemeButton /></div>
    {name && name !== user.email && <strong>{name}</strong>}
    {user.email && <span className="account-email">{user.email}</span>}
    {role && <span className="account-role">{role}</span>}
    <button type="button" className="account-signout" onClick={async () => { await signOut(); navigate('/login', { replace: true }) }}><LogOut size={16} />Sign out</button>
  </section>
}
