import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, FileUp, Plus, Search } from 'lucide-react'
import type { Note, NoteSummary, SearchHit } from '@/types'
import { AppHeader } from '@/components/layout/AppHeader'
import { Highlight } from '@/components/notes/NoteListItem'
import { TypeLabel } from '@/components/notes/NoteMetadata'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Kbd, Skeleton } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCategories, useCategoryMap, useCounts, useNotesIndex, useSearch } from '@/features/notes/hooks'
import { cleanSnippet, rankNotes } from '@/features/search/rank'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { greeting, relativeTime } from '@/lib/date'
import { cn, errorMessage, modKey } from '@/lib/utils'
import { NewNoteButton } from './AllNotesPage'

function SectionTitle({ children, to }: { children: React.ReactNode; to?: string }) {
  return (
    <div className="mb-1 flex items-center justify-between border-b border-line-soft pb-2">
      <h2 className="text-[13px] font-medium text-fg-muted">{children}</h2>
      {to && (
        <Link to={to} className="flex items-center gap-1 text-[12.5px] text-fg-faint hover:text-fg">
          View all <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  )
}

function CompactRow({
  note,
  right,
  query,
  snippet,
  active,
  onHover,
}: {
  note: NoteSummary
  right?: React.ReactNode
  query?: string
  snippet?: string | null
  active?: boolean
  onHover?: () => void
}) {
  const categoryMap = useCategoryMap()
  const category = note.category_id ? categoryMap.get(note.category_id) : null
  return (
    <Link
      to={`/notes/${note.slug}`}
      onMouseMove={onHover}
      className={cn(
        '-mx-3 flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-150',
        active ? 'bg-active' : 'hover:bg-hover',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-medium text-fg">
          <Highlight text={note.title} query={query} />
          {note.status === 'DRAFT' && <span className="ml-2 text-[12px] font-normal text-warning">Draft</span>}
        </p>
        {snippet && (
          <p className="mt-0.5 truncate font-mono text-[12px] text-fg-faint">
            <Highlight text={snippet} query={query} />
          </p>
        )}
      </div>
      <div className="hidden shrink-0 items-center gap-1.5 text-[12.5px] text-fg-muted sm:flex">
        <TypeLabel type={note.note_type} />
        {category && <span className="text-fg-faint">· {category.name}</span>}
      </div>
      {right && <span className="w-24 shrink-0 text-right text-[12.5px] text-fg-faint tabular-nums">{right}</span>}
    </Link>
  )
}

export function HomePage() {
  useDocumentTitle(null)
  const { isOwner, mode } = useAuth()
  const navigate = useNavigate()
  const index = useNotesIndex()
  const { data: categories = [] } = useCategories()
  const counts = useCounts()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const term = q.trim()
  const debounced = useDebouncedValue(term, 120)
  const search = useSearch(debounced)

  const notes = useMemo(() => (index.data ?? []).filter((n) => n.status !== 'ARCHIVED'), [index.data])
  const pinned = useMemo(() => notes.filter((n) => n.is_pinned).slice(0, 8), [notes])
  const recent = useMemo(() => notes.filter((n) => !n.is_pinned || pinned.length === 0).slice(0, 8), [notes, pinned.length])

  const localHits = useMemo(
    () => (term ? rankNotes(notes.map((n) => ({ ...n, content_markdown: '' }) as Note), categories, term, { limit: 10 }) : []),
    [notes, categories, term],
  )
  const fresh = search.data && !search.isPlaceholderData && debounced === term
  const hits: SearchHit[] = term ? (fresh ? search.data!.slice(0, 10) : localHits) : []
  const searching = term && (search.isFetching || debounced !== term)

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(hits.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && hits[active]) {
      navigate(`/notes/${hits[active].slug}`)
    } else if (e.key === 'Escape') {
      setQ('')
    }
  }

  const empty = !index.isPending && notes.length === 0

  return (
    <>
      <AppHeader crumbs={[{ label: 'Home' }]} actions={<NewNoteButton />} />
      <div className="mx-auto w-full max-w-[760px] px-4 pt-12 pb-24 md:px-8 md:pt-20">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] md:text-[32px]">{greeting()}.</h1>
        <p className="mt-1 text-[15px] text-fg-muted">
          {isOwner ? 'What do you want to find?' : 'Technical notes, snippets and troubleshooting guides.'}
        </p>

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-fg-faint" />
          <input
            ref={inputRef}
            autoFocus={isDesktop}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Search notes…"
            aria-label="Search notes"
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full rounded-lg border border-line bg-surface pr-24 pl-11 text-[15px] shadow-panel outline-none placeholder:text-fg-faint focus:border-accent"
          />
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
            {searching && <span className="size-3.5 animate-spin rounded-full border-2 border-fg-faint border-r-transparent" />}
            {!q && (
              <span className="hidden gap-0.5 md:flex">
                <Kbd>{modKey}</Kbd>
                <Kbd>K</Kbd>
              </span>
            )}
          </div>
        </div>

        {!term && counts.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-fg-faint">
            {counts.tags.slice(0, 10).map((t) => (
              <Link key={t.name} to={`/notes?tag=${encodeURIComponent(t.name)}`} className="hover:text-fg">
                #{t.name}
              </Link>
            ))}
          </div>
        )}

        {term ? (
          <section className="mt-8" aria-live="polite">
            <SectionTitle>Results</SectionTitle>
            {hits.length === 0 && !searching ? (
              <p className="py-6 text-sm text-fg-muted">No notes found for “{term}”.</p>
            ) : (
              hits.map((h, i) => (
                <CompactRow key={h.id} note={h} query={term} snippet={cleanSnippet(h.snippet)} active={i === active} onHover={() => setActive(i)} />
              ))
            )}
            {hits.length > 0 && (
              <Link to={`/notes?q=${encodeURIComponent(term)}`} className="mt-2 inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg">
                See all results <ArrowRight className="size-3" />
              </Link>
            )}
          </section>
        ) : index.error ? (
          <ErrorState message={`Failed to load notes. ${errorMessage(index.error)}`} onRetry={() => index.refetch()} />
        ) : index.isPending ? (
          <div className="mt-10 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={cn('h-5', i % 2 ? 'w-1/2' : 'w-2/3')} />
            ))}
          </div>
        ) : empty ? (
          isOwner ? (
            <EmptyState
              title="Your knowledge base is empty."
              description="Save the command you just looked up for the third time."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={() => navigate('/new')}>
                    <Plus className="size-4" /> New Note
                  </Button>
                  <Button onClick={() => navigate('/settings#import')}>
                    <FileUp className="size-4" /> Import Markdown
                  </Button>
                </div>
              }
            />
          ) : (
            <EmptyState title="Nothing published yet." />
          )
        ) : (
          <>
            {pinned.length > 0 && (
              <section className="mt-10">
                <SectionTitle to="/pinned">Pinned</SectionTitle>
                {pinned.map((n) => (
                  <CompactRow key={n.id} note={n} />
                ))}
              </section>
            )}
            <section className="mt-10">
              <SectionTitle to="/notes">{isOwner ? 'Recently updated' : 'Latest notes'}</SectionTitle>
              {recent.map((n) => (
                <CompactRow key={n.id} note={n} right={relativeTime(n.updated_at)} />
              ))}
            </section>
            {mode === 'local' && isOwner && (
              <p className="mt-10 text-[12.5px] text-fg-faint">
                Demo mode — notes are stored in this browser. Connect Supabase in <code>.env.local</code> to sync and publish.
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}
