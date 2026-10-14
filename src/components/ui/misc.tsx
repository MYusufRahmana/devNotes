import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-subtle px-1 font-sans text-[11px] font-medium text-fg-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-subtle', className)} />
}

export function NoteListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line-soft" aria-busy="true" aria-label="Loading notes">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2 py-4">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {icon && <div className="mb-3 text-fg-faint">{icon}</div>}
      <p className="text-[15px] font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-16 text-center">
      <p className="text-[15px] font-medium text-fg">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 h-8 rounded-md border border-line px-3 text-sm hover:bg-hover">
          Try again
        </button>
      )}
    </div>
  )
}
