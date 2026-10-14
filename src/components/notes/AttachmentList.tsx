import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, FileText, Loader2, Paperclip, Trash2 } from 'lucide-react'
import type { Attachment } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Dialog'
import { keys, useAttachments } from '@/features/notes/hooks'
import { source } from '@/features/notes/source'
import { errorMessage, formatBytes } from '@/lib/utils'

export function AttachmentList({ noteId, editable = false }: { noteId: string; editable?: boolean }) {
  const { data = [] } = useAttachments(noteId)
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)

  if (!data.length) return null

  async function open(a: Attachment) {
    setBusy(a.id)
    try {
      const url = await source.attachmentUrl(a, true)
      const link = document.createElement('a')
      link.href = url
      link.download = a.file_name
      link.target = '_blank'
      link.rel = 'noopener'
      link.click()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function remove(a: Attachment) {
    if (!(await confirm({ title: `Remove ${a.file_name}?`, confirmLabel: 'Remove', danger: true }))) return
    try {
      await source.deleteAttachment(a)
      qc.setQueryData<Attachment[]>(keys.attachments(noteId), (xs) => xs?.filter((x) => x.id !== a.id))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <section aria-label="Attachments">
      <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-fg-muted">
        <Paperclip className="size-3.5" /> Attachments
      </h2>
      <ul className="divide-y divide-line-soft rounded-lg border border-line">
        {data.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-3 py-2">
            <FileText className="size-4 shrink-0 text-fg-faint" />
            <button onClick={() => open(a)} className="min-w-0 flex-1 truncate text-left text-sm text-fg hover:underline">
              {a.file_name}
            </button>
            <span className="shrink-0 text-xs text-fg-faint tabular-nums">{formatBytes(a.file_size)}</span>
            <button
              onClick={() => open(a)}
              aria-label={`Download ${a.file_name}`}
              className="grid size-7 place-items-center rounded-md text-fg-faint hover:bg-hover hover:text-fg"
            >
              {busy === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            </button>
            {editable && (
              <button
                onClick={() => remove(a)}
                aria-label={`Remove ${a.file_name}`}
                className="grid size-7 place-items-center rounded-md text-fg-faint hover:bg-hover hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
