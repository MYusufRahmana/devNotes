import { useEffect, useState, type RefObject } from 'react'
import { cn } from '@/lib/utils'

interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

/**
 * Builds the TOC from the rendered DOM so ids always match rehype-slug.
 * Hidden when the note has fewer than `min` headings.
 */
export function TableOfContents({
  containerRef,
  deps,
  min = 3,
}: {
  containerRef: RefObject<HTMLElement | null>
  deps: unknown
  min?: number
}) {
  const [items, setItems] = useState<TocItem[]>([])
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const headings = Array.from(root.querySelectorAll<HTMLHeadingElement>('h2[id], h3[id]'))
    setItems(
      headings.map((h) => ({
        id: h.id,
        text: (h.textContent ?? '').replace(/^#/, '').trim(),
        level: h.tagName === 'H2' ? 2 : 3,
      })),
    )

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-72px 0px -65% 0px' },
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps])

  if (items.length < min) return null

  return (
    <nav aria-label="On this page" className="text-[13px]">
      <p className="mb-2 text-[11px] font-medium tracking-[0.04em] text-fg-faint uppercase">On this page</p>
      <ul className="space-y-0.5 border-l border-line-soft">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                history.replaceState(null, '', `#${item.id}`)
                setActive(item.id)
              }}
              className={cn(
                '-ml-px block border-l py-1 leading-snug transition-colors duration-150',
                item.level === 3 ? 'pl-6' : 'pl-3',
                active === item.id
                  ? 'border-fg font-medium text-fg'
                  : 'border-transparent text-fg-muted hover:text-fg',
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
