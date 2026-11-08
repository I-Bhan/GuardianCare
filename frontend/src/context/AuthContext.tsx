import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, Role } from '../lib/supabase'
import { AuthContext } from './auth-context'

async function loadProfile(user: User): Promise<Profile | null> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (data) return data
  } catch { /* RLS blocked — fall through */ }

  // Fallback: build from JWT metadata (set at registration)
  const m = user.user_metadata
  if (m?.full_name || m?.role) {
    return {
      id:         user.id,
      full_name:  m.full_name ?? user.email ?? '',
      role:       (m.role as Role) ?? 'viewer',
      created_at: '',
    }
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onAuthStateChange fires immediately with INITIAL_SESSION —
    // no need for a separate getSession() call.
    let revision = 0
    let pending: number | undefined
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const current = ++revision
        window.clearTimeout(pending)
        setLoading(true)
        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          // Start authenticated queries after the auth callback releases its lock.
          pending = window.setTimeout(async () => {
            const p = await loadProfile(currentUser)
            if (current !== revision) return
            setProfile(p)
            setLoading(false)
          }, 0)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )
    return () => {
      revision++
      window.clearTimeout(pending)
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut().catch(() => {})
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, role: profile?.role ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
