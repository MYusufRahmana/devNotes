import { useEffect, useState } from 'react'
import type { Category } from '@/types'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useCategoryActions } from '@/features/notes/hooks'
import { cn } from '@/lib/utils'
import { CATEGORY_ICONS } from './icons'

export function CategoryDialog({
  open,
  onClose,
  category,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  category?: Category | null
  onSaved?: (c: Category) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('hash')
  const { create, update } = useCategoryActions()
  const saving = create.isPending || update.isPending

  useEffect(() => {
    if (!open) return
    setName(category?.name ?? '')
    setDescription(category?.description ?? '')
    setIcon(category?.icon ?? 'hash')
  }, [open, category])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const input = { name: name.trim(), description: description.trim() || null, icon }
    const saved = category
      ? await update.mutateAsync({ id: category.id, input })
      : await create.mutateAsync(input)
    onSaved?.(saved)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} labelledBy="category-title">
      <form onSubmit={submit} className="p-5">
        <h2 id="category-title" className="text-[15px] font-semibold">
          {category ? 'Edit category' : 'New category'}
        </h2>

        <label className="mt-4 block text-[13px] font-medium text-fg-muted" htmlFor="cat-name">
          Name
        </label>
        <input
          id="cat-name"
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Kubernetes"
          className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none focus:border-accent"
        />

        <label className="mt-3 block text-[13px] font-medium text-fg-muted" htmlFor="cat-desc">
          Description <span className="font-normal text-fg-faint">(optional)</span>
        </label>
        <input
          id="cat-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={140}
          className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none focus:border-accent"
        />

        <p className="mt-3 text-[13px] font-medium text-fg-muted">Icon</p>
        <div className="mt-1.5 grid grid-cols-9 gap-1" role="radiogroup" aria-label="Icon">
          {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={icon === key}
              aria-label={key}
              title={key}
              onClick={() => setIcon(key)}
              className={cn(
                'grid aspect-square place-items-center rounded-md border transition-colors duration-150',
                icon === key ? 'border-fg bg-active text-fg' : 'border-transparent text-fg-muted hover:bg-hover',
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!name.trim()}>
            {category ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
