import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowDownAZ, CalendarPlus, Clock, FolderOpen, Hash, Layers, Search, Sparkles, X } from 'lucide-react'
import type { NoteSummary, SearchHit } from '@/types'
import { NOTE_TYPES } from '@/types'
import { AppHeader, type Crumb } from '@/components/layout/AppHeader'
import { EmptyState, ErrorState, NoteListSkeleton } from '@/components/ui/misc'
import { Select } from '@/components/ui/Select'
import { categoryIcon } from '@/features/categories/icons'
import { useCategories, useCategoryMap, useNotesIndex, useSearch } from '@/features/notes/hooks'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { NOTE_TYPE_META } from '@/lib/noteTypes'
import { errorMessage } from '@/lib/utils'
import { NoteListItem } from './NoteListItem'

type Sort = 'relevance' | 'updated' | 'created' | 'title'

export function NoteCollection({
  crumbs,
  title,
  description,
  filter,
  empty,
  lockCategoryId,
  includeArchived = false,
  actions,
  icon,
}: {
  crumbs: Crumb[]
  title: string
  description?: ReactNode
  filter: (n: NoteSummary) => boolean
  empty: ReactNode
  lockCategoryId?: string
  includeArchived?: boolean
  actions?: ReactNode
  icon?: ReactNode
}) {
  useDocumentTitle(title)
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const type = params.get('type') ?? ''
  const category = lockCategoryId ?? params.get('category') ?? ''
  const tag = params.get('tag') ?? ''
  const sort = (params.get('sort') as Sort | null) ?? (q ? 'relevance' : 'updated')

  const [input, setInput] = useState(q)
  const debounced = useDebouncedValue(input, 200)

  useEffect(() => setInput(q), [q])
  useEffect(() => {
    if (debounced.trim() === q) return
    setParam('q', debounced.trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  function setParam(key: string, value: string) {
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (value) next.set(key, value)
        else next.delete(key)
        if (key === 'q' && !value && next.get('sort') === 'relevance') next.delete('sort')
        return next
      },
      { replace: true },
    )
  }

  const index = useNotesIndex()
  const { data: categories = [] } = useCategories()
  const categoryMap = useCategoryMap()
  const search = useSearch(q, { includeArchived })

  const base = useMemo(() => (index.data ?? []).filter(filter), [index.data, filter])

  const tagOptions = useMemo(() => {
    const set = new Set<string>()
    base.forEach((n) => n.tags.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [base])

  const results = useMemo(() => {
    const allowed = new Set(base.map((n) => n.id))
    let list: Array<NoteSummary & Partial<Pick<SearchHit, 'snippet' | 'score'>>> = q
      ? (search.data ?? []).filter((h) => allowed.has(h.id))
      : base
    if (type) list = list.filter((n) => n.note_type === type)
    if (category) list = list.filter((n) => n.category_id === category)
    if (tag) list = list.filter((n) => n.tags.includes(tag))

    const sorted = [...list]
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'created') sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    else if (sort === 'updated' || !q) sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    return sorted
  }, [base, q, search.data, type, category, tag, sort])

  const hasFilters = Boolean(q || type || (!lockCategoryId && category) || tag)
  const loading = index.isPending || (q && search.isPending)
  const error = index.error ?? search.error

  return (
    <>
      <AppHeader crumbs={crumbs} actions={actions} />
      <div className="mx-auto w-full max-w-[880px] px-4 pt-8 pb-24 md:px-8">
        <div className="flex items-start gap-3">
          {icon && <div className="mt-1 text-fg-muted">{icon}</div>}
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{title}</h1>
            {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
          </div>
        </div>

        {(base.length > 0 || hasFilters) && (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex min-w-0 flex-1 items-center">
              <Search className="pointer-events-none absolute left-2.5 size-4 text-fg-faint" />
              <span className="sr-only">Filter notes</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setInput('')}
                placeholder="Search in title, content, tags…"
                className="h-8 w-full rounded-md border border-line bg-surface pr-8 pl-8 text-[13px] outline-none placeholder:text-fg-faint focus:border-accent"
              />
              {input && (
                <button
                  onClick={() => setInput('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 grid size-5 place-items-center rounded text-fg-faint hover:text-fg"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select
                label="Type"
                value={type}
                onChange={(v) => setParam('type', v)}
                options={[
                  { value: '', label: 'All types', icon: Layers },
                  ...NOTE_TYPES.map((t) => ({ value: t, label: NOTE_TYPE_META[t].label, icon: NOTE_TYPE_META[t].icon })),
                ]}
              />
              {!lockCategoryId && (
                <Select
                  label="Category"
                  value={category}
                  onChange={(v) => setParam('category', v)}
                  options={[
                    { value: '', label: 'All categories', icon: FolderOpen },
                    ...categories.map((c) => ({ value: c.id, label: c.name, icon: categoryIcon(c.icon) })),
                  ]}
                />
              )}
              <Select
                label="Tag"
                value={tag}
                onChange={(v) => setParam('tag', v)}
                options={[
                  { value: '', label: 'All tags', icon: Hash },
                  ...tagOptions.map((t) => ({ value: t, label: `#${t}` })),
                ]}
              />
              <Select
                label="Sort"
                value={sort}
                onChange={(v) => setParam('sort', v)}
                options={[
                  ...(q ? [{ value: 'relevance', label: 'Best match', icon: Sparkles }] : []),
                  { value: 'updated', label: 'Last updated', icon: Clock },
                  { value: 'created', label: 'Newest', icon: CalendarPlus },
                  { value: 'title', label: 'Title A–Z', icon: ArrowDownAZ },
                ]}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex h-6 items-center justify-between text-[12.5px] text-fg-faint">
          {!loading && (base.length > 0 || hasFilters) && (
            <span>
              {results.length} {results.length === 1 ? 'note' : 'notes'}
              {hasFilters && ' found'}
            </span>
          )}
          {hasFilters && (
            <button
              onClick={() => {
                setInput('')
                setParams(new URLSearchParams(), { replace: true })
              }}
              className="hover:text-fg"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-1 border-t border-line-soft">
          {error ? (
            <ErrorState
              message={`Failed to load notes. ${errorMessage(error)}`}
              onRetry={() => {
                index.refetch()
                if (q) search.refetch()
              }}
            />
          ) : loading ? (
            <NoteListSkeleton />
          ) : results.length === 0 ? (
            hasFilters ? (
              <EmptyState
                title={q ? `No notes found for “${q}”.` : 'No notes match these filters.'}
                description="Try fewer words, another tag, or clear the filters."
              />
            ) : (
              empty
            )
          ) : (
            <div className="divide-y divide-line-soft">
              {results.map((n) => (
                <NoteListItem
                  key={n.id}
                  note={n}
                  category={n.category_id ? categoryMap.get(n.category_id) : null}
                  query={q}
                  snippet={n.snippet}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
