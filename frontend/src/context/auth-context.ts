import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile, Role } from '../lib/supabase'

export interface AuthContextValue {
  user: User | null
  profile: Profile | null
  role: Role | null
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
