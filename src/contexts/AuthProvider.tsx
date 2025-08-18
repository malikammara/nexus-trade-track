import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  isAdmin: boolean
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// centralize your admin emails
const ADMIN_EMAILS = new Set([
  'doctorcrack007@gmail.com',
  'syedyousufhussainzaidi@gmail.com',
  'teamfalcons73@gmail.com',
].map(e => e.toLowerCase()))

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // compute isAdmin safely
  const isAdmin = useMemo(() => {
    if (!user) return false

    const email = (user.email ?? '').toLowerCase()
    if (ADMIN_EMAILS.has(email)) return true

    // optionally use app_metadata from Supabase (configure via Admin UI / signup hooks)
    const am: any = user.app_metadata ?? {}
    if (am?.role === 'admin') return true
    if (Array.isArray(am?.roles) && am.roles.includes('admin')) return true
    if (am?.is_admin === true) return true

    return false
  }, [user])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = supabase.auth.signOut()
    if ((await error) as any) throw error
  }

  const value: AuthContextType = {
    user,
    session,
    isAdmin,
    loading,
    signInWithGoogle,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
