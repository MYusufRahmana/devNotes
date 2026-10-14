import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  icon?: LucideIcon
  hint?: string
}

export interface SelectAction {
  label: string
  icon?: LucideIcon
  onSelect: () => void
}

/**
 * Custom listbox that matches the app's menus instead of the OS dropdown.
 * Keyboard: ↑ ↓ Home End to move, Enter to pick, Esc to close, type to filter.
 */
export function Select({
  value,
  onChange,
  options,
  label,
  action,
  variant = 'outline',
  searchable,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  label: string
  action?: SelectAction
  variant?: 'outline' | 'subtle'
  searchable?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState({ top: 0, left: 0, minWidth: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value) ?? options[0]
  const showSearch = searchable ?? options.length > 8

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  }, [options, query])
  // The trailing action counts as the last row for keyboard navigation.
  const rowCount = filtered.length + (action ? 1 : 0)

  function openMenu() {
    setQuery('')
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  function close(focusTrigger = true) {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  function pick(index: number) {
    if (index < filtered.length) {
      onChange(filtered[index].value)
      close()
    } else if (action) {
      close(false)
      action.onSelect()
    }
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const m = popRef.current.getBoundingClientRect()
    let top = r.bottom + 4
    if (top + m.height > window.innerHeight - 8) top = Math.max(8, r.top - m.height - 4)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - Math.max(m.width, r.width) - 8)
    setPos({ top, left, minWidth: r.width })
    ;(showSearch ? searchRef.current : popRef.current)?.focus()
  }, [open, showSearch])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) close(false)
    }
    const onResize = () => close(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  useEffect(() => {
    popRef.current?.querySelector(`[data-row="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(rowCount - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(rowCount - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (rowCount) pick(active)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  const Icon = selected?.icon

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            openMenu()
          }
        }}
        className={cn(
          'inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg pr-2 pl-2.5 text-[13px] text-fg transition-colors duration-150 outline-none',
          variant === 'outline'
            ? 'border border-line bg-surface hover:bg-hover focus-visible:border-accent'
            : 'bg-subtle hover:bg-active focus-visible:ring-2 focus-visible:ring-accent/40',
          open && (variant === 'outline' ? 'border-fg-faint/50' : 'bg-active'),
          className,
        )}
      >
        {Icon && <Icon className="size-3.5 shrink-0 text-fg-muted" />}
        <span className="min-w-0 flex-1 truncate text-left">{selected?.label}</span>
        <ChevronDown className={cn('size-3.5 shrink-0 text-fg-faint transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            style={{ top: pos.top, left: pos.left, minWidth: Math.max(pos.minWidth, 200) }}
            className="menu-in fixed z-[60] max-w-[320px] overflow-hidden rounded-xl bg-elevated text-sm text-fg shadow-pop outline-none ring-1 ring-line"
          >
            {showSearch && (
              <div className="flex items-center gap-2 border-b border-line-soft px-3">
                <Search className="size-3.5 shrink-0 text-fg-faint" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  placeholder={`Find ${label.toLowerCase()}…`}
                  aria-label={`Filter ${label}`}
                  aria-controls={listId}
                  className="h-9 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-faint"
                />
              </div>
            )}

            <div id={listId} role="listbox" aria-label={label} className="thin-scroll max-h-[280px] overflow-y-auto p-1">
              {filtered.map((o, i) => {
                const isSelected = o.value === value
                return (
                  <div
                    key={o.value}
                    data-row={i}
                    role="option"
                    aria-selected={isSelected}
                    onMouseMove={() => i !== active && setActive(i)}
                    onClick={() => pick(i)}
                    className={cn(
                      'flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2.5',
                      i === active && 'bg-hover',
                      isSelected && 'font-medium',
                    )}
                  >
                    {o.icon ? (
                      <o.icon className={cn('size-4 shrink-0', isSelected ? 'text-fg' : 'text-fg-faint')} />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="text-xs text-fg-faint">{o.hint}</span>}
                    <Check className={cn('size-3.5 shrink-0 text-accent', !isSelected && 'invisible')} />
                  </div>
                )
              })}
              {filtered.length === 0 && <p className="px-2.5 py-2 text-[13px] text-fg-faint">No matches</p>}
            </div>

            {action && (
              <div className="border-t border-line-soft p-1">
                <div
                  data-row={filtered.length}
                  role="button"
                  onMouseMove={() => setActive(filtered.length)}
                  onClick={() => pick(filtered.length)}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-fg-muted',
                    active === filtered.length && 'bg-hover text-fg',
                  )}
                >
                  {action.icon && <action.icon className="size-4 shrink-0" />}
                  <span>{action.label}</span>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
