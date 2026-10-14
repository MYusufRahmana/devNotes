import { useCallback, useMemo, useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { CategoryDialog } from '@/features/categories/CategoryDialog'
import { CommandPalette } from '@/components/search/CommandPalette'
import { useHotkey } from '@/hooks/useHotkey'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { SidebarContent } from './AppSidebar'
import { MobileSidebar } from './MobileSidebar'
import { ShortcutsDialog } from './ShortcutsDialog'
import { ShellContext, type ShellApi } from './ShellContext'

export function AppShell() {
  const { isOwner } = useAuth()
  const navigate = useNavigate()
  const isTablet = useMediaQuery('(max-width: 1023px)')
  const [collapsedPref, setCollapsedPref] = useLocalStorage<boolean | null>('devnotes:sidebar-collapsed', null)
  const collapsed = collapsedPref ?? isTablet

  const [palette, setPalette] = useState<{ open: boolean; initial: string }>({ open: false, initial: '' })
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)

  const closeMobile = useCallback(() => setMobileOpen(false), [])
  const closePalette = useCallback(() => setPalette((p) => ({ ...p, open: false })), [])
  const showShortcuts = useCallback(() => setShortcutsOpen(true), [])

  const shell = useMemo<ShellApi>(
    () => ({
      openPalette: (initial = '') => setPalette({ open: true, initial }),
      openShortcuts: showShortcuts,
      openMobileNav: () => setMobileOpen(true),
      openCategoryDialog: () => setCategoryOpen(true),
    }),
    [showShortcuts],
  )

  useHotkey('mod+k', (e) => {
    e.preventDefault()
    setPalette((p) => ({ open: !p.open, initial: '' }))
  })
  useHotkey('/', (e) => {
    e.preventDefault()
    shell.openPalette()
  })
  useHotkey('?', () => setShortcutsOpen(true))
  useHotkey('n', () => navigate('/new'), { enabled: isOwner })
  useHotkey('mod+\\', (e) => {
    e.preventDefault()
    setCollapsedPref(!collapsed)
  })

  return (
    <ShellContext.Provider value={shell}>
      <div className="flex min-h-dvh">
        <aside
          aria-label="Sidebar"
          className={cn(
            'sticky top-0 hidden h-dvh shrink-0 py-3 pl-3 transition-[width] duration-150 ease-out md:block',
            collapsed ? 'w-[76px]' : 'w-[264px]',
          )}
        >
          <div className="sidebar-float h-full overflow-hidden rounded-xl bg-surface">
            <SidebarContent collapsed={collapsed} onToggleCollapse={() => setCollapsedPref(!collapsed)} />
          </div>
        </aside>

        <MobileSidebar open={mobileOpen} onClose={closeMobile} />

        <main className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>

      <CommandPalette
        open={palette.open}
        initialQuery={palette.initial}
        onClose={closePalette}
        onShowShortcuts={showShortcuts}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {isOwner && <CategoryDialog open={categoryOpen} onClose={() => setCategoryOpen(false)} />}
    </ShellContext.Provider>
  )
}
