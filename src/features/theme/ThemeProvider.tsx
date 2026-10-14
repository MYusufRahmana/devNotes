import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export type Theme = 'system' | 'light' | 'dark'
export type ReaderFont = 'sans' | 'serif'

interface ThemeContextValue {
  theme: Theme
  resolved: 'light' | 'dark'
  setTheme: (t: Theme) => void
  cycleTheme: () => void
  readerFont: ReaderFont
  setReaderFont: (f: ReaderFont) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Stored raw (not JSON) so the inline script in index.html can read it.
  const [theme, setThemeState] = useLocalStorage<Theme>('devnotes:theme-pref', readInitialTheme())
  const [readerFont, setReaderFont] = useLocalStorage<ReaderFont>('devnotes:reader-font', 'sans')
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.documentElement.style.colorScheme = resolved
  }, [resolved])

  const value = useMemo<ThemeContextValue>(() => {
    const setTheme = (t: Theme) => {
      setThemeState(t)
      try {
        localStorage.setItem('devnotes:theme', t)
      } catch {
        /* ignore */
      }
    }
    const order: Theme[] = ['system', 'light', 'dark']
    return {
      theme,
      resolved,
      setTheme,
      cycleTheme: () => setTheme(order[(order.indexOf(theme) + 1) % order.length]),
      readerFont,
      setReaderFont,
    }
  }, [theme, resolved, readerFont, setThemeState, setReaderFont])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

function readInitialTheme(): Theme {
  try {
    const t = localStorage.getItem('devnotes:theme')
    if (t === 'light' || t === 'dark' || t === 'system') return t
  } catch {
    /* ignore */
  }
  return 'system'
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
