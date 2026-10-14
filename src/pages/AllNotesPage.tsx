import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import type { NoteSummary } from '@/types'
import { NoteCollection } from '@/components/notes/NoteCollection'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/AuthProvider'

const notArchived = (n: NoteSummary) => n.status !== 'ARCHIVED'

export function NewNoteButton({ category }: { category?: string }) {
  const navigate = useNavigate()
  const { isOwner } = useAuth()
  if (!isOwner) return null
  return (
    <Button size="sm" variant="primary" onClick={() => navigate(category ? `/new?category=${category}` : '/new')}>
      <Plus className="size-4" />
      <span className="hidden sm:inline">New Note</span>
    </Button>
  )
}

export function AllNotesPage() {
  const { isOwner } = useAuth()
  const navigate = useNavigate()
  return (
    <NoteCollection
      crumbs={[{ label: 'All Notes' }]}
      title="All Notes"
      filter={notArchived}
      actions={<NewNoteButton />}
      empty={
        isOwner ? (
          <EmptyState
            title="No notes yet."
            description="Create your first technical note."
            action={
              <Button variant="primary" onClick={() => navigate('/new')}>
                <Plus className="size-4" /> New Note
              </Button>
            }
          />
        ) : (
          <EmptyState title="Nothing published yet." />
        )
      }
    />
  )
}
