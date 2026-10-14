import { Pin, Star } from 'lucide-react'
import type { NoteSummary } from '@/types'
import { NoteCollection } from '@/components/notes/NoteCollection'
import { EmptyState } from '@/components/ui/misc'
import { NewNoteButton } from './AllNotesPage'

const isFavorite = (n: NoteSummary) => n.is_favorite && n.status !== 'ARCHIVED'
const isPinned = (n: NoteSummary) => n.is_pinned && n.status !== 'ARCHIVED'

export function FavoritesPage() {
  return (
    <NoteCollection
      crumbs={[{ label: 'Favorites' }]}
      title="Favorites"
      description="Notes you reach for often."
      filter={isFavorite}
      actions={<NewNoteButton />}
      empty={
        <EmptyState
          icon={<Star className="size-6" />}
          title="No favorites yet."
          description="Use the star on any note to keep it here."
        />
      }
    />
  )
}

export function PinnedPage() {
  return (
    <NoteCollection
      crumbs={[{ label: 'Pinned' }]}
      title="Pinned"
      description="The most important notes — shown first on Home."
      filter={isPinned}
      actions={<NewNoteButton />}
      empty={
        <EmptyState
          icon={<Pin className="size-6" />}
          title="Nothing pinned."
          description="Pin a note from its menu to keep it on Home."
        />
      }
    />
  )
}
