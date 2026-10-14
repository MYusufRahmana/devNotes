import { useMemo, useRef, useState } from 'react'
import { Hash, X } from 'lucide-react'
import { normalizeTags } from '@/features/notes/dataSource'
import { cn } from '@/lib/utils'

export function TagInput({
  value,
  onChange,
  suggestions,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
}) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [navigated, setNavigated] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    const d = draft.trim().toLowerCase().replace(/^#/, '')
    return suggestions.filter((s) => !value.includes(s) && (!d || s.includes(d))).slice(0, 6)
  }, [draft, suggestions, value])

  function add(raw: string) {
    const next = normalizeTags([...value, ...raw.split(',')])
    if (next.length !== value.length) onChange(next)
    setDraft('')
    setActive(0)
    setNavigated(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const suggestion = open && navigated ? matches[active] : undefined
    if (e.key === 'Enter' && (suggestion || draft.trim())) {
      e.preventDefault()
      add(suggestion ?? draft)
    } else if ((e.key === ',' || e.key === 'Tab') && draft.trim()) {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    } else if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault()
      setOpen(true)
      setNavigated(true)
      setActive((i) => (navigated ? Math.min(matches.length - 1, i + 1) : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-8 cursor-text flex-wrap items-center gap-1.5 text-[13px]"
      >
        <Hash className="size-3.5 shrink-0 text-fg-faint" aria-hidden />
        {value.map((t) => (
          <span key={t} className="inline-flex h-6 items-center gap-1 rounded-md bg-subtle pr-1 pl-2 text-fg-muted">
            {t}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(value.filter((x) => x !== t))
              }}
              aria-label={`Remove tag ${t}`}
              className="grid size-4 place-items-center rounded text-fg-faint hover:bg-hover hover:text-fg"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setOpen(true)
            setActive(0)
            setNavigated(false)
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setTimeout(() => setOpen(false), 120)
            if (draft.trim()) add(draft)
          }}
          placeholder={value.length ? '' : 'Add tags…'}
          aria-label="Tags"
          className="h-6 min-w-24 flex-1 bg-transparent outline-none placeholder:text-fg-faint"
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="menu-in absolute top-full left-5 z-30 mt-1 min-w-40 rounded-lg border border-line bg-elevated p-1 text-[13px] shadow-pop">
          {matches.map((m, i) => (
            <li key={m}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  add(m)
                }}
                onMouseMove={() => setActive(i)}
                className={cn('flex h-7 w-full items-center rounded-md px-2 text-left', i === active ? 'bg-active' : '')}
              >
                #{m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
