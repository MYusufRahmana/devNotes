import { createContext, useContext } from 'react'

export interface ShellApi {
  openPalette: (initial?: string) => void
  openShortcuts: () => void
  openMobileNav: () => void
  openCategoryDialog: () => void
}

export const ShellContext = createContext<ShellApi | null>(null)

export function useShell() {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell must be used inside AppShell')
  return ctx
}
