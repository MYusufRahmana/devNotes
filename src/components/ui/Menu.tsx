import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MenuItem {
  label: string
  icon?: LucideIcon
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  hint?: string
}

export type MenuEntry = MenuItem | 'separator'

export function Menu({
  trigger,
  items,
  align = 'end',
}: {
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode
  items: MenuEntry[]
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const anchorRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !menuRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const m = menuRef.current.getBoundingClientRect()
    let top = r.bottom + 4
    if (top + m.height > window.innerHeight - 8) top = Math.max(8, r.top - m.height - 4)
    let left = align === 'end' ? r.right - m.width : r.left
    left = Math.min(Math.max(8, left), window.innerWidth - m.width - 8)
    setPos({ top, left })
    menuRef.current.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus()
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        anchorRef.current?.querySelector<HTMLElement>('button')?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const list = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
        const idx = list.indexOf(document.activeElement as HTMLElement)
        const next = e.key === 'ArrowDown' ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length
        list[next]?.focus()
      }
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      </span>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, left: pos.left }}
            className="menu-in fixed z-[60] min-w-44 rounded-lg border border-line bg-elevated p-1 text-sm shadow-pop"
          >
            {items.map((item, i) =>
              item === 'separator' ? (
                <div key={i} className="my-1 h-px bg-line-soft" />
              ) : (
                <button
                  key={item.label}
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    item.onSelect()
                  }}
                  className={cn(
                    'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left outline-none',
                    'hover:bg-hover focus-visible:bg-hover disabled:opacity-40',
                    item.danger ? 'text-danger' : 'text-fg',
                  )}
                >
                  {item.icon && <item.icon className={cn('size-4', item.danger ? '' : 'text-fg-muted')} />}
                  <span className="flex-1">{item.label}</span>
                  {item.hint && <span className="text-xs text-fg-faint">{item.hint}</span>}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
