import { Globe2, Lock } from 'lucide-react'
import { Link } from 'react-router'
import type { Category, NoteSummary } from '@/types'
import { NOTE_TYPE_META } from '@/lib/noteTypes'
import { formatDate, relativeTime } from '@/lib/date'
import { cn } from '@/lib/utils'

export function TypeLabel({ type, className }: { type: NoteSummary['note_type']; className?: string }) {
  return (
    <span className={cn('text-[11px] font-medium tracking-[0.04em] text-fg-muted uppercase', className)}>
      {NOTE_TYPE_META[type].label}
    </span>
  )
}

export function StatusLabel({ note }: { note: NoteSummary }) {
  if (note.status === 'DRAFT') return <span className="text-[12px] font-medium text-warning">Draft</span>
  if (note.status === 'ARCHIVED') return <span className="text-[12px] font-medium text-fg-faint">Archived</span>
  return null
}

export function VisibilityIcon({ note, showPrivate = false }: { note: NoteSummary; showPrivate?: boolean }) {
  if (note.visibility === 'PUBLIC')
    return (
      <span title={note.status === 'PUBLISHED' ? 'Public' : 'Public once published'} className="inline-flex">
        <Globe2 className={cn('size-3.5', note.status === 'PUBLISHED' ? 'text-fg-muted' : 'text-fg-faint')} />
      </span>
    )
  if (showPrivate)
    return (
      <span title="Private" className="inline-flex">
        <Lock className="size-3.5 text-fg-faint" />
      </span>
    )
  return null
}

export function Dot() {
  return <span className="text-fg-faint">·</span>
}

/** "CHEATSHEET · Git · Updated 14 Oct 2026" */
export function NoteMetaLine({
  note,
  category,
  relative = false,
  className,
}: {
  note: NoteSummary
  category?: Category | null
  relative?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-fg-muted', className)}>
      <TypeLabel type={note.note_type} />
      {category && (
        <>
          <Dot />
          <Link to={`/category/${category.slug}`} className="relative z-10 hover:text-fg hover:underline">
            {category.name}
          </Link>
        </>
      )}
      <Dot />
      <span title={formatDate(note.updated_at)}>
        {relative ? relativeTime(note.updated_at) : `Updated ${formatDate(note.updated_at)}`}
      </span>
      <StatusLabel note={note} />
      <VisibilityIcon note={note} />
    </div>
  )
}
