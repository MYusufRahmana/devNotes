import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { MoreHorizontal, Pencil, Pin, Star } from 'lucide-react'
import { AppHeader } from '@/components/layout/AppHeader'
import { NoteReader } from '@/components/notes/NoteReader'
import { useNoteMenu } from '@/components/notes/useNoteMenu'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { ErrorState, Skeleton } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCategoryMap, useNote, useNotesIndex } from '@/features/notes/hooks'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useHotkey } from '@/hooks/useHotkey'
import { cn, errorMessage } from '@/lib/utils'
import { NotFoundPage } from './NotFoundPage'

export function NotePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { isOwner } = useAuth()
  const query = useNote({ slug })
  const index = useNotesIndex()
  const categories = useCategoryMap()
  const { items, actions } = useNoteMenu()

  // Index carries the freshest flags (optimistic pin/favorite), content comes from the note query.
  const fromIndex = index.data?.find((n) => n.id === query.data?.id)
  const note = query.data ? { ...query.data, ...(fromIndex ?? {}) } : null
  const category = note?.category_id ? categories.get(note.category_id) : null

  useDocumentTitle(note?.title)

  useEffect(() => {
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [slug, query.isSuccess])

  const ownerKeys = { enabled: isOwner && Boolean(note) }
  useHotkey('e', () => note && navigate(`/edit/${note.id}`), ownerKeys)
  useHotkey('f', () => note && actions.toggleFavorite(note), ownerKeys)
  useHotkey('p', () => note && actions.togglePin(note), ownerKeys)

  if (query.isPending) {
    return (
      <>
        <AppHeader crumbs={[{ label: 'Loading…' }]} />
        <div className="mx-auto w-full max-w-[740px] space-y-4 px-4 pt-14 md:px-8">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-3/4" />
          <div className="space-y-2.5 pt-8">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </>
    )
  }
  if (query.error) {
    return (
      <>
        <AppHeader crumbs={[{ label: 'Error' }]} />
        <ErrorState message={`Failed to load note. ${errorMessage(query.error)}`} onRetry={() => query.refetch()} />
      </>
    )
  }
  if (!note) return <NotFoundPage what="note" />

  const crumbs = [
    category ? { label: category.name, to: `/category/${category.slug}` } : { label: 'Notes', to: '/notes' },
    { label: note.title },
  ]

  return (
    <>
      <AppHeader
        crumbs={crumbs}
        actions={
          isOwner && (
            <>
              <button
                onClick={() => actions.togglePin(note)}
                aria-label={note.is_pinned ? 'Unpin' : 'Pin'}
                aria-pressed={note.is_pinned}
                title={note.is_pinned ? 'Unpin (P)' : 'Pin (P)'}
                className={cn(
                  'hidden size-8 place-items-center rounded-md hover:bg-hover sm:grid',
                  note.is_pinned ? 'text-fg' : 'text-fg-faint',
                )}
              >
                <Pin className={cn('size-4', note.is_pinned && 'fill-current')} />
              </button>
              <button
                onClick={() => actions.toggleFavorite(note)}
                aria-label={note.is_favorite ? 'Remove favorite' : 'Add to favorites'}
                aria-pressed={note.is_favorite}
                title="Favorite (F)"
                className="grid size-8 place-items-center rounded-md text-fg-faint hover:bg-hover"
              >
                <Star className={cn('size-4', note.is_favorite && 'fill-current text-warning')} />
              </button>
              {note.status !== 'ARCHIVED' && (
                <Button size="sm" onClick={() => navigate(`/edit/${note.id}`)} title="Edit (E)">
                  <Pencil className="size-3.5" /> Edit
                </Button>
              )}
              <Menu
                items={items(note, { inReader: true, afterDelete: () => navigate('/archive') })}
                trigger={(p) => (
                  <button {...p} aria-label="More actions" className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-hover">
                    <MoreHorizontal className="size-4" />
                  </button>
                )}
              />
            </>
          )
        }
      />

      {isOwner && note.status === 'DRAFT' && (
        <Banner tone="warning">
          Draft — only visible to you.
          <button onClick={() => actions.setStatus(note, 'PUBLISHED')} className="font-medium underline underline-offset-2">
            Publish{note.visibility === 'PUBLIC' ? ' publicly' : ''}
          </button>
        </Banner>
      )}
      {isOwner && note.status === 'ARCHIVED' && (
        <Banner tone="muted">
          This note is archived.
          <button onClick={() => actions.restore(note)} className="font-medium underline underline-offset-2">
            Restore
          </button>
        </Banner>
      )}

      <NoteReader note={note} category={category} />
    </>
  )
}

function Banner({ children, tone }: { children: React.ReactNode; tone: 'warning' | 'muted' }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 border-b px-4 py-2 text-[13px]',
        tone === 'warning' ? 'border-warning/20 bg-warning/8 text-fg' : 'border-line-soft bg-subtle text-fg-muted',
      )}
    >
      {children}
    </div>
  )
}
