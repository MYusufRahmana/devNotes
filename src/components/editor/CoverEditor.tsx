import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { SmartImage } from '@/components/notes/SmartImage'
import { IMAGE_TYPES, validateImage } from '@/lib/uploads'
import { cn } from '@/lib/utils'

/**
 * Medium-style cover: a quiet "Add cover" button when empty,
 * a wide image with Change / Remove on hover when set.
 * Accepts click-to-upload and drag & drop.
 */
export function CoverEditor({
  value,
  onChange,
  onUpload,
  onError,
}: {
  value: string | null
  onChange: (url: string | null) => void
  onUpload: (file: File) => Promise<string>
  onError: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  async function upload(file: File | undefined) {
    if (!file) return
    const error = validateImage(file)
    if (error) return onError(error)
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      onChange(await onUpload(file))
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Cover upload failed')
    } finally {
      setUploading(false)
      setPreview(null)
    }
  }

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('Files')) {
        e.preventDefault()
        setDragging(true)
      }
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      upload(Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/')))
    },
  }

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept={IMAGE_TYPES.join(',')}
      hidden
      onChange={(e) => {
        upload(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  const shown = preview ?? value

  if (!shown) {
    return (
      <div {...dropProps} className={cn('rounded-lg transition-colors duration-150', dragging && 'bg-accent-soft')}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-fg-faint transition-colors duration-150 hover:bg-hover hover:text-fg-muted',
            dragging && 'text-accent',
          )}
        >
          <ImagePlus className="size-4" />
          {dragging ? 'Drop to set cover' : 'Add cover'}
        </button>
        {picker}
      </div>
    )
  }

  return (
    <div {...dropProps} className="group/cover relative overflow-hidden rounded-xl bg-subtle">
      {preview ? (
        <img src={preview} alt="" className="aspect-[2/1] w-full object-cover opacity-60" />
      ) : (
        <SmartImage src={value} alt="Cover" className="aspect-[2/1] w-full object-cover" placeholderClassName="aspect-[2/1]" />
      )}

      {uploading && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-[13px] text-white">
            <Loader2 className="size-3.5 animate-spin" /> Uploading cover…
          </span>
        </div>
      )}
      {dragging && (
        <div className="absolute inset-0 grid place-items-center border-2 border-dashed border-accent bg-accent-soft text-sm font-medium text-accent">
          Drop to replace cover
        </div>
      )}

      {!uploading && (
        <div className="absolute right-3 bottom-3 flex gap-1.5 opacity-0 transition-opacity duration-150 group-focus-within/cover:opacity-100 group-hover/cover:opacity-100 [@media(hover:none)]:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-black/60 px-2.5 text-[13px] font-medium text-white backdrop-blur-sm hover:bg-black/75"
          >
            <RefreshCw className="size-3.5" /> Change
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove cover"
            className="grid size-8 place-items-center rounded-lg bg-black/60 text-white backdrop-blur-sm hover:bg-black/75"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
      {picker}
    </div>
  )
}
