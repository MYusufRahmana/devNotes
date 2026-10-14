import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import type { NoteSummary } from '@/types'
import { NoteCollection } from '@/components/notes/NoteCollection'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { useConfirm } from '@/components/ui/Dialog'
import { EmptyState, NoteListSkeleton } from '@/components/ui/misc'
import { AppHeader } from '@/components/layout/AppHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { CategoryDialog } from '@/features/categories/CategoryDialog'
import { categoryIcon } from '@/features/categories/icons'
import { useCategories, useCategoryActions, useCounts } from '@/features/notes/hooks'
import { NewNoteButton } from './AllNotesPage'
import { NotFoundPage } from './NotFoundPage'

export function CategoryPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { isOwner } = useAuth()
  const confirm = useConfirm()
  const { data: categories, isPending } = useCategories()
  const { remove } = useCategoryActions()
  const counts = useCounts()
  const [editing, setEditing] = useState(false)
  const category = categories?.find((c) => c.slug === slug)

  const filter = useCallback(
    (n: NoteSummary) => n.category_id === category?.id && n.status !== 'ARCHIVED',
    [category?.id],
  )

  if (isPending)
    return (
      <>
        <AppHeader crumbs={[{ label: 'Library' }]} />
        <div className="mx-auto w-full max-w-[880px] px-4 pt-8 md:px-8">
          <NoteListSkeleton />
        </div>
      </>
    )
  if (!category) return <NotFoundPage what="category" />

  const Icon = categoryIcon(category.icon)
  const noteCount = counts.byCategory.get(category.id) ?? 0

  return (
    <>
      <NoteCollection
        key={category.id}
        crumbs={[{ label: 'Library' }, { label: category.name }]}
        title={category.name}
        icon={<Icon className="size-5" />}
        description={category.description}
        filter={filter}
        lockCategoryId={category.id}
        actions={
          <>
            <NewNoteButton category={category.slug} />
            {isOwner && (
              <Menu
                items={[
                  { label: 'Edit category', icon: Pencil, onSelect: () => setEditing(true) },
                  {
                    label: 'Delete category',
                    icon: Trash2,
                    danger: true,
                    onSelect: async () => {
                      const ok = await confirm({
                        title: `Delete “${category.name}”?`,
                        description:
                          noteCount > 0
                            ? `${noteCount} ${noteCount === 1 ? 'note stays' : 'notes stay'} in your library without a category.`
                            : 'This category has no notes.',
                        confirmLabel: 'Delete',
                        danger: true,
                      })
                      if (ok) {
                        await remove.mutateAsync(category)
                        navigate('/notes')
                      }
                    },
                  },
                ]}
                trigger={(p) => (
                  <button {...p} aria-label="Category options" className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-hover">
                    <MoreHorizontal className="size-4" />
                  </button>
                )}
              />
            )}
          </>
        }
        empty={
          <EmptyState
            title={`No notes in ${category.name} yet.`}
            action={
              isOwner && (
                <Button variant="primary" onClick={() => navigate(`/new?category=${category.slug}`)}>
                  <Plus className="size-4" /> New {category.name} note
                </Button>
              )
            }
          />
        }
      />
      <CategoryDialog
        open={editing}
        onClose={() => setEditing(false)}
        category={category}
        onSaved={(c) => c.slug !== slug && navigate(`/category/${c.slug}`, { replace: true })}
      />
    </>
  )
}
