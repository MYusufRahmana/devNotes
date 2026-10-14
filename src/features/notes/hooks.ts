import { useMemo } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Category, CategoryInput, Note, NotePatch, NoteSummary } from '@/types'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/utils'
import { source } from './source'

export const keys = {
  notes: (uid: string | undefined) => ['notes', uid ?? 'public'] as const,
  note: (by: string) => ['note', by] as const,
  categories: (uid: string | undefined) => ['categories', uid ?? 'public'] as const,
  search: (uid: string | undefined, q: string, archived: boolean) => ['search', uid ?? 'public', q, archived] as const,
  attachments: (noteId: string) => ['attachments', noteId] as const,
}

export function useNotesIndex() {
  const { user, ready } = useAuth()
  return useQuery({
    queryKey: keys.notes(user?.id),
    queryFn: () => source.listNotes(),
    enabled: ready,
    staleTime: 30_000,
  })
}

export function useCategories() {
  const { user, ready } = useAuth()
  return useQuery({
    queryKey: keys.categories(user?.id),
    queryFn: () => source.listCategories(),
    enabled: ready,
    staleTime: 60_000,
  })
}

export function useCategoryMap() {
  const { data } = useCategories()
  return useMemo(() => new Map((data ?? []).map((c) => [c.id, c])), [data])
}

export function useNote(by: { slug?: string; id?: string }) {
  const { ready } = useAuth()
  const key = by.id ? `id:${by.id}` : `slug:${by.slug}`
  return useQuery({
    queryKey: keys.note(key),
    queryFn: () => source.getNote(by),
    enabled: ready && Boolean(by.id || by.slug),
    staleTime: 10_000,
  })
}

export function useSearch(q: string, { includeArchived = false, enabled = true } = {}) {
  const { user, ready } = useAuth()
  const trimmed = q.trim()
  return useQuery({
    queryKey: keys.search(user?.id, trimmed, includeArchived),
    queryFn: () => source.search(trimmed, { includeArchived }),
    enabled: ready && enabled && trimmed.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export interface Counts {
  all: number
  favorites: number
  pinned: number
  drafts: number
  archived: number
  byCategory: Map<string, number>
  tags: Array<{ name: string; count: number }>
}

export function countNotes(notes: NoteSummary[]): Counts {
  const counts: Counts = { all: 0, favorites: 0, pinned: 0, drafts: 0, archived: 0, byCategory: new Map(), tags: [] }
  const tagCounts = new Map<string, number>()
  for (const n of notes) {
    if (n.status === 'ARCHIVED') {
      counts.archived++
      continue
    }
    counts.all++
    if (n.status === 'DRAFT') counts.drafts++
    if (n.is_favorite) counts.favorites++
    if (n.is_pinned) counts.pinned++
    if (n.category_id) counts.byCategory.set(n.category_id, (counts.byCategory.get(n.category_id) ?? 0) + 1)
    for (const t of n.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  }
  counts.tags = Array.from(tagCounts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  )
  return counts
}

export function useCounts(): Counts {
  const { data } = useNotesIndex()
  return useMemo(() => countNotes(data ?? []), [data])
}

/** Writes a fresh note into every cache that holds it. */
export function usePutNoteInCache() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return (note: Note) => {
    const { content_markdown: _c, ...summary } = note
    void _c
    qc.setQueryData<NoteSummary[]>(keys.notes(user?.id), (list) => {
      if (!list) return list
      const exists = list.some((n) => n.id === note.id)
      return exists ? list.map((n) => (n.id === note.id ? summary : n)) : [summary, ...list]
    })
    qc.setQueryData(keys.note(`id:${note.id}`), note)
    qc.setQueryData(keys.note(`slug:${note.slug}`), note)
  }
}

export function useNoteActions() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const toast = useToast()
  const put = usePutNoteInCache()
  const notesKey = keys.notes(user?.id)

  const invalidateDerived = () => {
    qc.invalidateQueries({ queryKey: ['search'] })
    qc.invalidateQueries({ queryKey: ['categories'] })
  }

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NotePatch }) => source.updateNote(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: notesKey })
      const previous = qc.getQueryData<NoteSummary[]>(notesKey)
      qc.setQueryData<NoteSummary[]>(notesKey, (list) => list?.map((n) => (n.id === id ? { ...n, ...patch } : n)))
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(notesKey, ctx.previous)
      toast.error(errorMessage(err))
    },
    onSuccess: (note) => {
      put(note)
      invalidateDerived()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => source.deleteNote(id),
    onSuccess: (_r, id) => {
      qc.setQueryData<NoteSummary[]>(notesKey, (list) => list?.filter((n) => n.id !== id))
      qc.removeQueries({ queryKey: ['note'] })
      invalidateDerived()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return {
    toggleFavorite: (n: NoteSummary) => update.mutate({ id: n.id, patch: { is_favorite: !n.is_favorite } }),
    togglePin: (n: NoteSummary) => update.mutate({ id: n.id, patch: { is_pinned: !n.is_pinned } }),
    archive: (n: NoteSummary) =>
      update.mutate(
        { id: n.id, patch: { status: 'ARCHIVED', is_pinned: false } },
        {
          onSuccess: () =>
            toast.success(`Archived “${n.title}”`, {
              label: 'Undo',
              onClick: () => update.mutate({ id: n.id, patch: { status: n.status, is_pinned: n.is_pinned } }),
            }),
        },
      ),
    /** Back to where it was: published if it was ever published, otherwise draft. */
    restore: (n: NoteSummary) =>
      update.mutate(
        { id: n.id, patch: { status: n.published_at ? 'PUBLISHED' : 'DRAFT' } },
        { onSuccess: () => toast.success(`Restored “${n.title}”`) },
      ),
    setStatus: (n: NoteSummary, status: NoteSummary['status']) => update.mutate({ id: n.id, patch: { status } }),
    deleteForever: (n: NoteSummary) =>
      remove.mutateAsync(n.id).then(() => toast.success(`Deleted “${n.title}” permanently`)),
    update,
  }
}

export function useCategoryActions() {
  const qc = useQueryClient()
  const toast = useToast()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['categories'] })
    qc.invalidateQueries({ queryKey: ['notes'] })
  }
  const create = useMutation({
    mutationFn: (input: CategoryInput) => source.createCategory(input),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CategoryInput & { sort_order: number }> }) =>
      source.updateCategory(id, input),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (c: Category) => source.deleteCategory(c.id),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  })
  return { create, update, remove }
}

export function useAttachments(noteId: string | undefined) {
  return useQuery({
    queryKey: keys.attachments(noteId ?? ''),
    queryFn: () => source.listAttachments(noteId!),
    enabled: Boolean(noteId),
  })
}
