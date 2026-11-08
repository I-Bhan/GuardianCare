import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

import WorkspaceAccount, { ThemeButton } from './WorkspaceAccount'

export default function Navbar() {
  const { user, profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [openAt, setOpenAt] = useState<string | null>(null)
  const workspace = !!user && /^\/(dashboard|admin)\/?$/.test(pathname)
  const open = openAt === pathname
  const close = () => setOpenAt(null)
  const links = [{ to: '/', label: 'Home' }, { to: '/about', label: 'About' }]
  if (user) links.push({ to: '/dashboard', label: 'Dashboard' })
  if (role === 'admin') links.push({ to: '/admin', label: 'Admin' })

  return <header className={workspace ? "site-top workspace-top" : "site-top"}>
    <nav className="wrap site-header" aria-label="Main navigation">
      <Link className="gc-brand" to="/" onClick={close}><img src="/guardiancare-wordmark.png" alt="GuardianCare" width={237} height={69} /></Link>
      <div className="site-nav">{links.map(l => <NavLink key={l.to} end to={l.to}>{l.label}</NavLink>)}</div>
      <div className="header-actions">
        {!workspace && <ThemeButton />}
        {!workspace && (user ? <><span className="header-signin account-name">{profile?.full_name}</span><button aria-label="Sign out" className="icon-button" onClick={async () => { await signOut(); close(); navigate('/login') }}><LogOut size={17}/></button></> :
          <><Link to="/login" className="header-signin" onClick={close}>Sign in</Link><Link to="/register" className="btn-primary register-link" onClick={close}>Create account</Link></>)}
        <button className="icon-button menu-toggle" aria-label="Navigation menu" aria-expanded={open} onClick={() => setOpenAt(open ? null : pathname)}>{open ? <X size={18}/> : <Menu size={18}/>}</button>
      </div>
    </nav>
    {open && <nav className="mobile-links" aria-label="Mobile navigation">{links.map(l => <NavLink key={l.to} end to={l.to} onClick={close}>{l.label}</NavLink>)}{!user && <Link to="/register" onClick={close}>Create account</Link>}{workspace && <WorkspaceAccount />}</nav>}
  </header>
}
