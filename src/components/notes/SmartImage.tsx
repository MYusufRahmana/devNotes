import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { LOCAL_IMAGE_PROTOCOL, resolveLocalImage } from '@/features/notes/localSource'
import { cn } from '@/lib/utils'

/** Resolves `local-image://` (demo mode) to a blob URL; passes other URLs through. */
export function useImageSrc(src: string | null | undefined) {
  const isLocal = Boolean(src?.startsWith(LOCAL_IMAGE_PROTOCOL))
  const [resolved, setResolved] = useState<string | undefined>(isLocal ? undefined : (src ?? undefined))

  useEffect(() => {
    if (!src) return setResolved(undefined)
    if (!isLocal) return setResolved(src)
    let active = true
    setResolved(undefined)
    resolveLocalImage(src).then((u) => active && setResolved(u ?? undefined))
    return () => {
      active = false
    }
  }, [src, isLocal])

  return resolved
}

export function SmartImage({
  src,
  alt,
  className,
  zoomable = false,
  placeholderClassName,
  ...props
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null
  zoomable?: boolean
  placeholderClassName?: string
}) {
  const resolved = useImageSrc(src)
  const [zoomed, setZoomed] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [resolved])

  if (!resolved || failed) {
    return (
      <span
        className={cn(
          'flex w-full items-center justify-center rounded-lg bg-subtle text-[13px] text-fg-faint',
          !failed && 'animate-pulse',
          placeholderClassName ?? 'h-48',
        )}
      >
        {failed ? 'Image could not be loaded' : null}
      </span>
    )
  }

  return (
    <>
      <img
        src={resolved}
        alt={alt ?? ''}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        onClick={zoomable ? () => setZoomed(true) : undefined}
        className={cn(zoomable && 'cursor-zoom-in', className)}
        {...props}
      />
      {zoomed && <Lightbox src={resolved} alt={alt ?? ''} onClose={() => setZoomed(false)} />}
    </>
  )
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image'}
      onClick={onClose}
      className="backdrop-fade fixed inset-0 z-[80] flex cursor-zoom-out items-center justify-center bg-black/80 p-4 md:p-10"
    >
      <img src={src} alt={alt} className="dialog-in max-h-full max-w-full rounded-lg object-contain shadow-pop" />
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="size-4" />
      </button>
    </div>,
    document.body,
  )
}
