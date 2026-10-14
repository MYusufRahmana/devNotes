import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AuthUser } from '@/types'
import { source } from '@/features/notes/source'

interface AuthContextValue {
  user: AuthUser | null
  isOwner: boolean
  ready: boolean
  mode: 'supabase' | 'local'
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Unsaved-draft backups hold private note content; never leave them behind on sign-out. */
function clearDraftBackups() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('devnotes:backup:'))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* storage unavailable */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    source.getUser().then((u) => {
      if (!active) return
      setUser(u)
      setReady(true)
    })
    const unsubscribe = source.onAuthChange((u) => {
      setUser((prev) => {
        if (prev?.id !== u?.id) queryClient.removeQueries()
        return u
      })
      setReady(true)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [queryClient])

  const signIn = useCallback(async (email: string, password: string) => {
    await source.signIn(email, password)
    setUser(await source.getUser())
  }, [])

  const signOut = useCallback(async () => {
    await source.signOut()
    setUser(null)
    queryClient.removeQueries()
    clearDraftBackups()
  }, [queryClient])

  const value = useMemo(
    () => ({ user, isOwner: Boolean(user), ready, mode: source.mode, signIn, signOut }),
    [user, ready, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
