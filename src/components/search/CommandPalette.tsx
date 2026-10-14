import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Archive,
  ArrowRight,
  CornerDownLeft,
  FileText,
  Home,
  Keyboard,
  LogIn,
  Moon,
  PenLine,
  Pin,
  Plus,
  Search,
  Settings,
  Star,
  type LucideIcon,
} from 'lucide-react'
import type { Note, SearchHit } from '@/types'
import { Dialog } from '@/components/ui/Dialog'
import { Kbd } from '@/components/ui/misc'
import { Highlight } from '@/components/notes/NoteListItem'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/features/theme/ThemeProvider'
import { useCategories, useCategoryMap, useNotesIndex, useSearch } from '@/features/notes/hooks'
import { cleanSnippet, rankNotes } from '@/features/search/rank'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { NOTE_TYPE_META } from '@/lib/noteTypes'
import { cn, modKey } from '@/lib/utils'

interface Command {
  id: string
  label: string
  icon: LucideIcon
  run: () => void
  keywords?: string
  hint?: string
}

type Row = { kind: 'note'; hit: SearchHit } | { kind: 'command'; cmd: Command }

export function CommandPalette({
  open,
  initialQuery = '',
  onClose,
  onShowShortcuts,
}: {
  open: boolean
  initialQuery?: string
  onClose: () => void
  onShowShortcuts: () => void
}) {
  const [q, setQ] = useState(initialQuery)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { isOwner } = useAuth()
  const { cycleTheme } = useTheme()
  const { data: index = [] } = useNotesIndex()
  const { data: categories = [] } = useCategories()
  const categoryMap = useCategoryMap()

  useEffect(() => {
    if (open) {
      setQ(initialQuery)
      setActive(0)
    }
  }, [open, initialQuery])

  const commandMode = q.startsWith('>')
  const term = commandMode ? q.slice(1).trim() : q.trim()
  const debounced = useDebouncedValue(term, 120)
  const search = useSearch(debounced, { enabled: open && !commandMode })

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => navigate(path)
    const list: Command[] = []
    if (isOwner) list.push({ id: 'new', label: 'Create new note', icon: Plus, run: go('/new'), hint: 'N', keywords: 'add write' })
    list.push({ id: 'home', label: 'Go to Home', icon: Home, run: go('/') })
    list.push({ id: 'all', label: 'Go to All Notes', icon: FileText, run: go('/notes') })
    if (isOwner) {
      list.push(
        { id: 'fav', label: 'Open Favorites', icon: Star, run: go('/favorites') },
        { id: 'pin', label: 'Open Pinned', icon: Pin, run: go('/pinned') },
        { id: 'drafts', label: 'Open Drafts', icon: PenLine, run: go('/drafts') },
        { id: 'archive', label: 'Open Archive', icon: Archive, run: go('/archive') },
        { id: 'settings', label: 'Open Settings', icon: Settings, run: go('/settings'), keywords: 'export import categories' },
      )
    } else {
      list.push({ id: 'login', label: 'Sign in', icon: LogIn, run: go('/login') })
    }
    list.push(
      { id: 'theme', label: 'Toggle theme', icon: Moon, run: cycleTheme, keywords: 'dark light mode' },
      { id: 'keys', label: 'Keyboard shortcuts', icon: Keyboard, run: onShowShortcuts, hint: '?' },
    )
    return list
  }, [isOwner, navigate, cycleTheme, onShowShortcuts])

  // Instant local results (titles/tags/category) while the ranked query is in flight.
  const localHits = useMemo(() => {
    if (!term || commandMode) return []
    const asNotes = index.map((n) => ({ ...n, content_markdown: '' }) as Note)
    return rankNotes(asNotes, categories, term, { limit: 12 })
  }, [index, categories, term, commandMode])

  const rows = useMemo<Row[]>(() => {
    const matchCmd = (c: Command) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(term.toLowerCase())
    if (commandMode) return commands.filter(matchCmd).map((cmd) => ({ kind: 'command', cmd }))
    if (!term) {
      const recent = index
        .filter((n) => n.status !== 'ARCHIVED')
        .slice(0, 5)
        .map((n): Row => ({ kind: 'note', hit: { ...n, snippet: null, score: 0 } }))
      return [...recent, ...commands.slice(0, 4).map((cmd): Row => ({ kind: 'command', cmd }))]
    }
    const serverFresh = search.data && !search.isPlaceholderData && debounced === term
    const hits = serverFresh ? search.data! : localHits
    return [
      ...hits.map((hit): Row => ({ kind: 'note', hit })),
      ...commands.filter(matchCmd).slice(0, 3).map((cmd): Row => ({ kind: 'command', cmd })),
    ]
  }, [commandMode, commands, term, index, search.data, search.isPlaceholderData, debounced, localHits])

  useEffect(() => setActive(0), [term])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function run(row: Row | undefined, edit = false) {
    if (!row) return
    onClose()
    if (row.kind === 'command') row.cmd.run()
    else navigate(edit && isOwner ? `/edit/${row.hit.id}` : `/notes/${row.hit.slug}`)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(rows.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(rows[active], e.metaKey || e.ctrlKey)
    }
  }

  const noteRows = rows.filter((r) => r.kind === 'note').length
  const searching = Boolean(term) && !commandMode && (search.isFetching || debounced !== term)
  const firstCommandIndex = rows.findIndex((r) => r.kind === 'command')

  return (
    <Dialog open={open} onClose={onClose} position="top" className="max-w-[640px] overflow-hidden" labelledBy="palette-label">
      <div className="flex items-center gap-2.5 border-b border-line-soft px-4">
        <Search className="size-4.5 shrink-0 text-fg-faint" />
        <label id="palette-label" htmlFor="palette-input" className="sr-only">
          Search notes or type &gt; for commands
        </label>
        <input
          id="palette-input"
          data-autofocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search notes…  (type > for commands)"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={rows[active] ? `palette-row-${active}` : undefined}
          className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-faint"
        />
        {searching && <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-fg-faint border-r-transparent" />}
        <Kbd className="hidden sm:inline-flex">Esc</Kbd>
      </div>

      <div ref={listRef} id="palette-list" role="listbox" className="thin-scroll max-h-[min(60vh,440px)] overflow-y-auto p-1.5">
        {!term && !commandMode && noteRows > 0 && <GroupLabel>Recently updated</GroupLabel>}
        {term && !commandMode && noteRows > 0 && <GroupLabel>Notes</GroupLabel>}

        {term && !commandMode && noteRows === 0 && !searching && (
          <p className="px-3 py-6 text-center text-sm text-fg-muted">
            No notes found for “{term}”.
          </p>
        )}

        {rows.map((row, i) => (
          <div key={row.kind === 'note' ? row.hit.id : row.cmd.id}>
            {i === firstCommandIndex && <GroupLabel>{commandMode ? 'Commands' : 'Actions'}</GroupLabel>}
            <div
              id={`palette-row-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => i !== active && setActive(i)}
              onClick={() => run(row)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2',
                i === active ? 'bg-active' : 'hover:bg-hover',
              )}
            >
              {row.kind === 'note' ? (
                <NoteRow hit={row.hit} query={term} categoryName={row.hit.category_id ? categoryMap.get(row.hit.category_id)?.name : undefined} />
              ) : (
                <>
                  <row.cmd.icon className="size-4 shrink-0 text-fg-muted" />
                  <span className="flex-1 text-sm text-fg">{row.cmd.label}</span>
                  {row.cmd.hint && <Kbd>{row.cmd.hint}</Kbd>}
                </>
              )}
              {i === active && <ArrowRight className="size-3.5 shrink-0 text-fg-faint" />}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden items-center gap-4 border-t border-line-soft px-4 py-2 text-[11.5px] text-fg-faint sm:flex">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navigate
        </span>
        <span className="flex items-center gap-1">
          <Kbd>
            <CornerDownLeft className="size-3" />
          </Kbd>
          open
        </span>
        {isOwner && (
          <span className="flex items-center gap-1">
            <Kbd>{modKey}</Kbd>
            <Kbd>
              <CornerDownLeft className="size-3" />
            </Kbd>
            edit
          </span>
        )}
        <span className="ml-auto">
          <Kbd>&gt;</Kbd> commands
        </span>
      </div>
    </Dialog>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-[0.04em] text-fg-faint uppercase">{children}</p>
}

function NoteRow({ hit, query, categoryName }: { hit: SearchHit; query: string; categoryName?: string }) {
  const Icon = NOTE_TYPE_META[hit.note_type].icon
  const snippet = cleanSnippet(hit.snippet) ?? (query ? null : hit.excerpt)
  return (
    <>
      <Icon className="size-4 shrink-0 text-fg-faint" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-fg">
            <Highlight text={hit.title} query={query} />
          </span>
          {hit.status === 'DRAFT' && <span className="shrink-0 text-[11px] text-warning">Draft</span>}
        </div>
        <div className="truncate text-xs text-fg-muted">
          <span className="font-medium tracking-[0.03em] uppercase">{NOTE_TYPE_META[hit.note_type].label}</span>
          {categoryName && <> · {categoryName}</>}
          {hit.tags.length > 0 && <span className="text-fg-faint"> · {hit.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}</span>}
        </div>
        {snippet && (
          <div className="mt-0.5 truncate font-mono text-[11.5px] text-fg-faint">
            <Highlight text={snippet} query={query} />
          </div>
        )}
      </div>
    </>
  )
}
