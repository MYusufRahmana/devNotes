import { useNavigate } from 'react-router'
import {
  Archive,
  ArchiveRestore,
  Download,
  ExternalLink,
  Link2,
  Pencil,
  Pin,
  PinOff,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react'
import type { NoteSummary } from '@/types'
import type { MenuEntry } from '@/components/ui/Menu'
import { useConfirm } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { copyText } from '@/components/editor/CodeBlock'
import { useCategoryMap, useNoteActions } from '@/features/notes/hooks'
import { exportNote } from '@/features/notes/portability'
import { source } from '@/features/notes/source'
import { errorMessage } from '@/lib/utils'

export function noteUrl(note: Pick<NoteSummary, 'slug'>) {
  return `${window.location.origin}/notes/${note.slug}`
}

export function useNoteMenu() {
  const navigate = useNavigate()
  const actions = useNoteActions()
  const confirm = useConfirm()
  const toast = useToast()
  const categories = useCategoryMap()

  async function doExport(note: NoteSummary) {
    try {
      const full = await source.getNote({ id: note.id })
      if (full) exportNote(full, full.category_id ? categories.get(full.category_id) : null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function deleteForever(note: NoteSummary, after?: () => void) {
    const ok = await confirm({
      title: 'Delete permanently?',
      description: (
        <>
          “{note.title}” and its uploaded files will be removed. This cannot be undone.
        </>
      ),
      confirmLabel: 'Delete forever',
      danger: true,
    })
    if (ok) {
      await actions.deleteForever(note)
      after?.()
    }
  }

  function items(note: NoteSummary, { inReader = false, afterDelete }: { inReader?: boolean; afterDelete?: () => void } = {}): MenuEntry[] {
    if (note.status === 'ARCHIVED') {
      return [
        { label: 'Restore', icon: ArchiveRestore, onSelect: () => actions.restore(note) },
        { label: 'Export as Markdown', icon: Download, onSelect: () => doExport(note) },
        'separator',
        { label: 'Delete permanently', icon: Trash2, danger: true, onSelect: () => deleteForever(note, afterDelete) },
      ]
    }
    const isPublic = note.visibility === 'PUBLIC' && note.status === 'PUBLISHED'
    return [
      ...(!inReader ? [{ label: 'Open', icon: ExternalLink, onSelect: () => navigate(`/notes/${note.slug}`) }] : []),
      { label: 'Edit', icon: Pencil, hint: inReader ? 'E' : undefined, onSelect: () => navigate(`/edit/${note.id}`) },
      {
        label: note.is_pinned ? 'Unpin' : 'Pin to home',
        icon: note.is_pinned ? PinOff : Pin,
        onSelect: () => actions.togglePin(note),
      },
      {
        label: note.is_favorite ? 'Remove favorite' : 'Add to favorites',
        icon: note.is_favorite ? StarOff : Star,
        onSelect: () => actions.toggleFavorite(note),
      },
      'separator',
      {
        label: isPublic ? 'Copy public link' : 'Copy link',
        icon: Link2,
        onSelect: async () => {
          if (await copyText(noteUrl(note))) toast.success(isPublic ? 'Public link copied' : 'Link copied (sign-in required)')
        },
      },
      { label: 'Export as Markdown', icon: Download, onSelect: () => doExport(note) },
      'separator',
      { label: 'Archive', icon: Archive, onSelect: () => actions.archive(note) },
    ]
  }

  return { items, actions, deleteForever }
}
