import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import { SidebarContent } from './AppSidebar'

/** Off-canvas drawer for small screens. Closes on outside click, Escape or navigation. */
export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation()

  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-40 md:hidden">
      <div className="backdrop-fade absolute inset-0 bg-overlay" onClick={onClose} aria-hidden />
      <aside
        aria-label="Navigation"
        className="drawer-in sidebar-float absolute inset-y-2 left-2 w-[85vw] max-w-[280px] overflow-hidden rounded-xl bg-surface"
      >
        <SidebarContent collapsed={false} onClose={onClose} onNavigate={onClose} />
      </aside>
    </div>,
    document.body,
  )
}
