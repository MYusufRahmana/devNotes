import { Archive } from 'lucide-react'
import type { NoteSummary } from '@/types'
import { NoteCollection } from '@/components/notes/NoteCollection'
import { EmptyState } from '@/components/ui/misc'

const isArchived = (n: NoteSummary) => n.status === 'ARCHIVED'

export function ArchivePage() {
  return (
    <NoteCollection
      crumbs={[{ label: 'Archived' }]}
      title="Archived"
      description="Archived notes stay recoverable. Restore them, or delete permanently from the note menu."
      filter={isArchived}
      includeArchived
      empty={<EmptyState icon={<Archive className="size-6" />} title="Archive is empty." />}
    />
  )
}
