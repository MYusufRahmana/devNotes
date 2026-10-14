import { useEffect, useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import { NOTE_TYPE_META } from '@/lib/noteTypes'
import type { TemplateKey } from '@/lib/templates'
import { Kbd } from '@/components/ui/misc'
import { cn } from '@/lib/utils'

const OPTIONS: Array<{ key: TemplateKey; label: string; description: string; icon: typeof FilePlus2 }> = [
  { key: 'BLANK', label: 'Blank', description: 'Start from nothing.', icon: FilePlus2 },
  ...(['SNIPPET', 'CHEATSHEET', 'TROUBLESHOOTING', 'GUIDE', 'ARTICLE'] as const).map((t) => ({
    key: t,
    label: NOTE_TYPE_META[t].label,
    description: NOTE_TYPE_META[t].description,
    icon: NOTE_TYPE_META[t].icon,
  })),
]

export function TemplatePicker({ onPick }: { onPick: (key: TemplateKey) => void }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const n = Number(e.key)
      if (n >= 1 && n <= OPTIONS.length) {
        e.preventDefault()
        onPick(OPTIONS[n - 1].key)
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setActive((i) => (i + 1) % OPTIONS.length)
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setActive((i) => (i - 1 + OPTIONS.length) % OPTIONS.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onPick(OPTIONS[active].key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onPick])

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-14 pb-24 md:px-8">
      <h1 className="text-[22px] font-semibold tracking-[-0.015em]">New note</h1>
      <p className="mt-1 text-sm text-fg-muted">Choose a starting point. You can change the type later.</p>
      <ul className="mt-6 overflow-hidden rounded-xl border border-line bg-surface" role="listbox" aria-label="Templates">
        {OPTIONS.map((o, i) => (
          <li key={o.key} className={cn(i > 0 && 'border-t border-line-soft')}>
            <button
              role="option"
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => onPick(o.key)}
              className={cn(
                'flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors duration-150',
                i === active ? 'bg-hover' : '',
              )}
            >
              <o.icon className="size-4.5 shrink-0 text-fg-muted" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{o.label}</span>
                <span className="block text-[13px] text-fg-muted">{o.description}</span>
              </span>
              <Kbd>{i + 1}</Kbd>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
