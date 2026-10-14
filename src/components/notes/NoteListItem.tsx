import { memo } from 'react'
import { Link } from 'react-router'
import { MoreHorizontal, Pin, Star } from 'lucide-react'
import type { Category, NoteSummary } from '@/types'
import { Menu } from '@/components/ui/Menu'
import { cleanSnippet, highlightParts } from '@/features/search/rank'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'
import { NoteMetaLine } from './NoteMetadata'
import { SmartImage } from './SmartImage'
import { useNoteMenu } from './useNoteMenu'

export function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>
  return (
    <>
      {highlightParts(text, query).map((p, i) => (p.match ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  )
}

function NoteListItemImpl({
  note,
  category,
  query,
  snippet,
  showTags = true,
}: {
  note: NoteSummary
  category?: Category | null
  query?: string
  snippet?: string | null
  showTags?: boolean
}) {
  const { isOwner } = useAuth()
  const { items, actions } = useNoteMenu()
  const body = (query && cleanSnippet(snippet)) || note.excerpt

  return (
    <article className="group relative -mx-3 rounded-lg px-3 py-3.5 transition-colors duration-150 hover:bg-hover">
      <Link to={`/notes/${note.slug}`} className="absolute inset-0 rounded-lg" aria-label={note.title} />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-[15px] leading-snug font-semibold text-fg">
            <span className="truncate">
              <Highlight text={note.title} query={query} />
            </span>
            {note.is_pinned && <Pin className="size-3 shrink-0 text-fg-faint" aria-label="Pinned" />}
          </h3>
          {body && (
            <p className="mt-0.5 line-clamp-1 text-[13.5px] text-fg-muted">
              <Highlight text={body} query={query} />
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <NoteMetaLine note={note} category={category} />
            {showTags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-x-2 text-[12.5px] text-fg-faint">
                {note.tags.slice(0, 4).map((t) => (
                  <Link key={t} to={`/notes?tag=${encodeURIComponent(t)}`} className="relative z-10 hover:text-fg">
                    #{t}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {note.cover_image && (
          <SmartImage
            src={note.cover_image}
            alt=""
            className="mt-0.5 hidden h-[60px] w-[92px] shrink-0 rounded-md object-cover shadow-[0_0_0_1px_var(--line-soft)] sm:block"
            placeholderClassName="mt-0.5 hidden h-[60px] w-[92px] shrink-0 rounded-md sm:block"
          />
        )}

        {isOwner && (
          <div
            className={cn(
              'relative z-10 flex shrink-0 items-center gap-0.5 transition-opacity duration-150',
              'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
            )}
          >
            {note.status !== 'ARCHIVED' && (
              <button
                onClick={() => actions.toggleFavorite(note)}
                aria-label={note.is_favorite ? 'Remove favorite' : 'Add to favorites'}
                aria-pressed={note.is_favorite}
                className="grid size-8 place-items-center rounded-md text-fg-faint hover:bg-hover hover:text-fg"
              >
                <Star className={cn('size-4', note.is_favorite && 'fill-current text-warning')} />
              </button>
            )}
            <Menu
              items={items(note)}
              trigger={(p) => (
                <button
                  {...p}
                  aria-label="More actions"
                  className="grid size-8 place-items-center rounded-md text-fg-faint hover:bg-hover hover:text-fg"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              )}
            />
          </div>
        )}
      </div>
      {isOwner && note.is_favorite && !note.cover_image && (
        <Star className="absolute top-4 right-3 size-3.5 fill-current text-warning group-hover:hidden [@media(hover:none)]:hidden" aria-label="Favorite" />
      )}
    </article>
  )
}

export const NoteListItem = memo(NoteListItemImpl)
