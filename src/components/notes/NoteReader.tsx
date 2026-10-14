import { useMemo, useRef } from 'react'
import { Link } from 'react-router'
import type { Category, Note, NoteSummary } from '@/types'
import { useTheme } from '@/features/theme/ThemeProvider'
import { useNotesIndex } from '@/features/notes/hooks'
import { NOTE_TYPE_META } from '@/lib/noteTypes'
import { formatDate } from '@/lib/date'
import { countHeadings, stripDuplicateTitle } from '@/lib/markdown'
import { Markdown } from './Markdown'
import { SmartImage } from './SmartImage'
import { TableOfContents } from './TableOfContents'
import { AttachmentList } from './AttachmentList'
import { Dot, VisibilityIcon } from './NoteMetadata'

/** Related by shared tags (×2) and same category (×1). No AI. */
function useRelated(note: Note, limit = 4): NoteSummary[] {
  const { data } = useNotesIndex()
  return useMemo(() => {
    const tags = new Set(note.tags)
    return (data ?? [])
      .filter((n) => n.id !== note.id && n.status !== 'ARCHIVED')
      .map((n) => ({
        n,
        score: n.tags.filter((t) => tags.has(t)).length * 2 + (note.category_id && n.category_id === note.category_id ? 1 : 0),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.n.updated_at.localeCompare(a.n.updated_at))
      .slice(0, limit)
      .map((x) => x.n)
  }, [data, note, limit])
}

export function NoteReader({ note, category, showAttachments = true }: { note: Note; category?: Category | null; showAttachments?: boolean }) {
  const { readerFont } = useTheme()
  const articleRef = useRef<HTMLDivElement>(null)
  const related = useRelated(note)
  const content = useMemo(() => stripDuplicateTitle(note.content_markdown, note.title), [note.content_markdown, note.title])
  const hasToc = countHeadings(content) >= 3

  return (
    <div className="mx-auto flex w-full max-w-[1120px] justify-center gap-12 px-4 pt-10 pb-28 md:px-8 md:pt-14">
      <article className="w-full max-w-[740px] min-w-0">
        <header>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-fg-muted">
            {category && (
              <>
                <Link to={`/category/${category.slug}`} className="font-medium text-fg-muted hover:text-fg">
                  {category.name}
                </Link>
                <Dot />
              </>
            )}
            <Link to={`/notes?type=${note.note_type}`} className="hover:text-fg">
              {NOTE_TYPE_META[note.note_type].label}
            </Link>
            <Dot />
            <span title={`Created ${formatDate(note.created_at)}`}>Updated {formatDate(note.updated_at)}</span>
            {note.reading_time > 1 && (
              <>
                <Dot />
                <span>{note.reading_time} min read</span>
              </>
            )}
            <span className="ml-1">
              <VisibilityIcon note={note} />
            </span>
          </div>
          <h1 className="mt-3 text-[30px] leading-[1.2] font-bold tracking-[-0.022em] text-balance md:text-[36px]">
            {note.title}
          </h1>
        </header>

        {note.cover_image ? (
          // Cover breaks out slightly wider than the text column, like Medium.
          <figure className="my-8 md:-mx-10">
            <SmartImage
              src={note.cover_image}
              alt=""
              zoomable
              className="max-h-[70vh] w-full rounded-xl object-cover shadow-[0_0_0_1px_var(--line-soft)]"
              placeholderClassName="aspect-[2/1] rounded-xl"
            />
          </figure>
        ) : (
          <hr className="my-8 border-line-soft" />
        )}

        <div ref={articleRef}>
          {content.trim() ? (
            <Markdown content={content} serif={readerFont === 'serif'} />
          ) : (
            <p className="text-fg-faint italic">This note is empty.</p>
          )}
        </div>

        {(note.tags.length > 0 || showAttachments) && <hr className="mt-12 mb-6 border-line-soft" />}

        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-fg-muted">
            {note.tags.map((t) => (
              <Link key={t} to={`/notes?tag=${encodeURIComponent(t)}`} className="hover:text-fg">
                #{t}
              </Link>
            ))}
          </div>
        )}

        {showAttachments && (
          <div className="mt-6">
            <AttachmentList noteId={note.id} />
          </div>
        )}

        {related.length > 0 && (
          <section className="mt-12" aria-label="Related notes">
            <h2 className="mb-2 text-[13px] font-medium text-fg-muted">Related</h2>
            <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line-soft sm:grid-cols-2">
              {related.map((r) => (
                <Link key={r.id} to={`/notes/${r.slug}`} className="bg-surface px-4 py-3 transition-colors duration-150 hover:bg-subtle">
                  <p className="truncate text-sm font-medium text-fg">{r.title}</p>
                  <p className="mt-0.5 text-[11px] font-medium tracking-[0.04em] text-fg-faint uppercase">
                    {NOTE_TYPE_META[r.note_type].label}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      {hasToc && (
        <aside className="hidden w-[200px] shrink-0 xl:block">
          <div className="thin-scroll sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto">
            <TableOfContents containerRef={articleRef} deps={content} />
          </div>
        </aside>
      )}
    </div>
  )
}
