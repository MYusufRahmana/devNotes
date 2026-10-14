import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, ChevronRight, Menu as MenuIcon, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShell } from './ShellContext'

export interface Crumb {
  label: string
  to?: string
}

/** Minimal content header: breadcrumb/title on the left, actions on the right. */
export function AppHeader({
  crumbs,
  actions,
  className,
  onBack,
}: {
  crumbs: Crumb[]
  actions?: ReactNode
  className?: string
  onBack?: () => void
}) {
  const shell = useShell()
  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line-soft bg-bg px-4 md:px-8',
        className,
      )}
    >
      <button
        onClick={shell.openMobileNav}
        aria-label="Open menu"
        className="-ml-1.5 grid size-8 place-items-center rounded-md text-fg-muted hover:bg-hover md:hidden"
      >
        <MenuIcon className="size-4.5" />
      </button>
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back"
          title="Back (Esc)"
          className="grid size-8 shrink-0 place-items-center rounded-md text-fg-muted hover:bg-hover hover:text-fg md:-ml-2"
        >
          <ArrowLeft className="size-4" />
        </button>
      )}

      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-fg-faint" />}
              {c.to && !last ? (
                <Link to={c.to} className="shrink-0 truncate text-fg-muted hover:text-fg">
                  {c.label}
                </Link>
              ) : (
                <span className={cn('truncate', last ? 'font-medium text-fg' : 'text-fg-muted')} aria-current={last ? 'page' : undefined}>
                  {c.label}
                </span>
              )}
            </Fragment>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => shell.openPalette()}
          aria-label="Search"
          className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-hover md:hidden"
        >
          <Search className="size-4.5" />
        </button>
        {actions}
      </div>
    </header>
  )
}
