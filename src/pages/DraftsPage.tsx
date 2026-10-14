import { PenLine } from 'lucide-react'
import type { NoteSummary } from '@/types'
import { NoteCollection } from '@/components/notes/NoteCollection'
import { EmptyState } from '@/components/ui/misc'
import { NewNoteButton } from './AllNotesPage'

const isDraft = (n: NoteSummary) => n.status === 'DRAFT'

export function DraftsPage() {
  return (
    <NoteCollection
      crumbs={[{ label: 'Drafts' }]}
      title="Drafts"
      description="Unfinished notes. Only you can see them."
      filter={isDraft}
      actions={<NewNoteButton />}
      empty={<EmptyState icon={<PenLine className="size-6" />} title="No drafts." description="Everything is published." />}
    />
  )
}
