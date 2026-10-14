import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { validateImage } from '@/lib/uploads'
import { cn, modKey } from '@/lib/utils'
import * as cmd from './commands'

export interface NoteEditorHandle {
  focus: () => void
  textarea: () => HTMLTextAreaElement | null
  insertImages: (files: File[]) => void
}

/**
 * Markdown textarea with list continuation, Tab indent, formatting shortcuts,
 * and paste / drag-and-drop image upload.
 */
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const NoteEditor = forwardRef<
  NoteEditorHandle,
  {
    value: string
    onChange: (value: string) => void
    onUploadImage: (file: File) => Promise<string>
    onDropFiles: (files: File[]) => void
    onError: (message: string) => void
    placeholder?: string
    className?: string
  }
>(function NoteEditor({ value, onChange, onUploadImage, onDropFiles, onError, placeholder, className }, ref) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [dragging, setDragging] = useState(false)

  // Auto-grow without making the page jump.
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    const scrollY = window.scrollY
    ta.style.height = 'auto'
    ta.style.height = `${Math.max(ta.scrollHeight, 320)}px`
    window.scrollTo({ top: scrollY })
  }, [value])

  // Remember where the caret was, so toolbar/file-picker uploads land there
  // even after the textarea has lost focus. Never touched → append at the end.
  const caret = useRef<{ start: number; end: number } | null>(null)
  const rememberCaret = () => {
    const ta = taRef.current
    if (ta) caret.current = { start: ta.selectionStart, end: ta.selectionEnd }
  }

  async function insertImages(files: File[]) {
    const ta = taRef.current
    if (!ta) return
    const valid = files.filter((file) => {
      const error = validateImage(file)
      if (error) onError(error)
      return !error
    })
    if (!valid.length) return

    if (document.activeElement !== ta) {
      const pos = caret.current ?? { start: ta.value.length, end: ta.value.length }
      ta.focus()
      ta.setSelectionRange(pos.start, pos.end)
    }

    // Each image becomes its own block (rendered as a figure), placed at the caret.
    const jobs = valid.map((file, i) => {
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '').replace(/[-_]+/g, ' ')
      const token = `![Uploading ${alt}… ${Date.now().toString(36)}${i}]()`
      cmd.insertBlock(ta, token)
      return { file, alt, token }
    })
    rememberCaret()

    await Promise.all(
      jobs.map(async ({ file, alt, token }) => {
        try {
          const url = await onUploadImage(file)
          onChange((taRef.current?.value ?? '').replace(token, `![${alt}](${url})`))
        } catch (e) {
          onError(e instanceof Error ? e.message : 'Image upload failed')
          onChange((taRef.current?.value ?? '').replace(new RegExp(`\\n*${escapeRe(token)}\\n*`), '\n\n'))
        }
      }),
    )
  }

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
    textarea: () => taRef.current,
    insertImages,
  }))

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget
    const mod = e.metaKey || e.ctrlKey
    if (e.nativeEvent.isComposing) return

    if (e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey) {
      if (cmd.handleEnter(ta)) e.preventDefault()
      return
    }
    if (e.key === 'Tab' && !mod && !e.altKey) {
      e.preventDefault()
      cmd.handleTab(ta, e.shiftKey)
      return
    }
    if (mod && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase()
      if (k === 'b') {
        e.preventDefault()
        cmd.wrap(ta, '**')
      } else if (k === 'i') {
        e.preventDefault()
        cmd.wrap(ta, '_')
      } else if (k === 'e') {
        e.preventDefault()
        cmd.wrap(ta, '`', '`', 'code')
      }
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const images = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (images.length) {
      e.preventDefault()
      insertImages(images)
      return
    }
    // Pasting a URL over selected text turns it into a link.
    const text = e.clipboardData.getData('text/plain')
    const ta = e.currentTarget
    if (/^https?:\/\/\S+$/.test(text.trim()) && ta.selectionStart !== ta.selectionEnd) {
      e.preventDefault()
      const label = ta.value.slice(ta.selectionStart, ta.selectionEnd)
      cmd.replaceRange(ta, ta.selectionStart, ta.selectionEnd, `[${label}](${text.trim()})`)
    }
  }

  function onDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    e.preventDefault()
    const images = files.filter((f) => f.type.startsWith('image/'))
    const others = files.filter((f) => !f.type.startsWith('image/'))
    if (images.length) insertImages(images)
    if (others.length) onDropFiles(others)
  }

  return (
    <div className={cn('relative', className)}>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onSelect={rememberCaret}
        onBlur={rememberCaret}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setDragging(true)
          }
        }}
        onDragLeave={() => setDragging(false)}
        placeholder={placeholder ?? `Write in Markdown…  Paste or drop images.  ${modKey}+B bold, ${modKey}+E code`}
        spellCheck={false}
        aria-label="Note content (Markdown)"
        className="editor-textarea block w-full resize-none overflow-hidden bg-transparent text-fg outline-none placeholder:text-fg-faint"
      />
      {dragging && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg border-2 border-dashed border-accent bg-accent-soft">
          <span className="flex items-center gap-2 text-sm font-medium text-accent">
            <ImagePlus className="size-4" /> Drop images or files to upload
          </span>
        </div>
      )}
    </div>
  )
})
