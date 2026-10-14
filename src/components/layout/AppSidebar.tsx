import type { ReactNode } from 'react'
import { NavLink, Link, useNavigate } from 'react-router'
import {
  Archive,
  FileText,
  Home,
  LogIn,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Pin,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/features/theme/ThemeProvider'
import { useCategories, useCounts } from '@/features/notes/hooks'
import { categoryIcon } from '@/features/categories/icons'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn, modKey } from '@/lib/utils'
import { LogoMark } from './Logo'
import { useShell } from './ShellContext'

function SectionLabel({ children, collapsed, action }: { children: ReactNode; collapsed: boolean; action?: ReactNode }) {
  if (collapsed) return <div className="mx-auto my-2.5 h-px w-5 bg-line" />
  return (
    <div className="group/label flex h-8 items-end justify-between px-2.5 pb-1.5">
      <span className="text-[11px] font-medium tracking-[0.04em] text-fg-faint uppercase">{children}</span>
      {action}
    </div>
  )
}

function NavItem({
  to,
  icon: Icon,
  label,
  count,
  collapsed,
  end,
  onNavigate,
}: {
  to: string
  icon: LucideIcon
  label: string
  count?: number
  collapsed: boolean
  end?: boolean
  onNavigate?: () => void
}) {
  return (
    <Tooltip label={count ? `${label} · ${count}` : label} enabled={collapsed}>
      <NavLink
        to={to}
        end={end}
        onClick={onNavigate}
        aria-label={collapsed ? label : undefined}
        className={({ isActive }) =>
          cn(
            'group/item flex h-9 items-center gap-2.5 rounded-lg text-[13.5px] transition-colors duration-150',
            collapsed ? 'mx-auto w-9 justify-center' : 'px-2.5',
            isActive ? 'bg-active font-medium text-fg' : 'text-fg-muted hover:bg-hover hover:text-fg',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn('size-4 shrink-0', !isActive && 'text-fg-faint group-hover/item:text-fg-muted')} strokeWidth={isActive ? 2 : 1.75} />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {/* Counts stay out of the way until you look for them. */}
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      'text-xs text-fg-faint tabular-nums transition-opacity duration-150',
                      isActive ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100 [@media(hover:none)]:opacity-100',
                    )}
                  >
                    {count}
                  </span>
                )}
              </>
            )}
          </>
        )}
      </NavLink>
    </Tooltip>
  )
}

function IconAction({
  label,
  onClick,
  children,
  className,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        aria-label={label}
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg text-fg-faint transition-colors duration-150 hover:bg-hover hover:text-fg',
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

export function SidebarContent({
  collapsed,
  onToggleCollapse,
  onClose,
  onNavigate,
}: {
  collapsed: boolean
  onToggleCollapse?: () => void
  onClose?: () => void
  onNavigate?: () => void
}) {
  const { isOwner } = useAuth()
  const { theme, cycleTheme } = useTheme()
  const shell = useShell()
  const navigate = useNavigate()
  const counts = useCounts()
  const { data: categories = [] } = useCategories()

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  const themeLabel = `Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`
  const visibleCategories = isOwner ? categories : categories.filter((c) => counts.byCategory.get(c.id))
  const pad = collapsed ? 'px-0' : 'px-2'

  return (
    <div className="group/sidebar flex h-full flex-col py-2">
      {/* Header */}
      <div className={cn('flex h-11 shrink-0 items-center', collapsed ? 'justify-center' : 'justify-between pr-2 pl-3')}>
        {collapsed ? (
          <Tooltip label={`Expand sidebar (${modKey}+\\)`}>
            <button
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              className="group/logo relative grid size-9 place-items-center rounded-lg hover:bg-hover"
            >
              <LogoMark className="size-6 transition-opacity duration-150 group-hover/logo:opacity-0" />
              <PanelLeftOpen className="absolute size-4 text-fg-muted opacity-0 transition-opacity duration-150 group-hover/logo:opacity-100" />
            </button>
          </Tooltip>
        ) : (
          <>
            <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5 rounded-md">
              <LogoMark />
              <span className="text-[15px] font-semibold tracking-[-0.01em]">DevNotes</span>
            </Link>
            {onClose ? (
              <button onClick={onClose} aria-label="Close menu" className="grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-hover">
                <X className="size-4" />
              </button>
            ) : (
              <button
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                title={`Collapse sidebar (${modKey}+\\)`}
                className="grid size-8 place-items-center rounded-lg text-fg-faint opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 hover:bg-hover hover:text-fg focus-visible:opacity-100"
              >
                <PanelLeftClose className="size-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Search */}
      <div className={cn('shrink-0 pt-1.5 pb-1', collapsed ? 'px-0' : 'px-2')}>
        {collapsed ? (
          <Tooltip label={`Search (${modKey}+K)`}>
            <button
              onClick={() => shell.openPalette()}
              aria-label="Search notes"
              className="mx-auto grid size-9 place-items-center rounded-lg text-fg-faint hover:bg-hover hover:text-fg"
            >
              <Search className="size-4" />
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={() => {
              onNavigate?.()
              shell.openPalette()
            }}
            className="flex h-9 w-full items-center gap-2.5 rounded-lg bg-subtle px-2.5 text-[13.5px] text-fg-faint transition-colors duration-150 hover:text-fg-muted"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Search</span>
            <span className="text-[11.5px] font-medium tracking-wide [@media(hover:none)]:hidden">{modKey} K</span>
          </button>
        )}
      </div>

      {/* General — no label needed for the first group */}
      <nav aria-label="General" className={cn('shrink-0 space-y-px pt-2', pad)}>
        <NavItem to="/" end icon={Home} label="Home" collapsed={collapsed} onNavigate={onNavigate} />
        {isOwner && (
          <>
            <NavItem to="/favorites" icon={Star} label="Favorites" count={counts.favorites} collapsed={collapsed} onNavigate={onNavigate} />
            <NavItem to="/pinned" icon={Pin} label="Pinned" count={counts.pinned} collapsed={collapsed} onNavigate={onNavigate} />
          </>
        )}
        <NavItem to="/notes" end icon={FileText} label="All Notes" count={counts.all} collapsed={collapsed} onNavigate={onNavigate} />
      </nav>

      {/* Library — the only part that scrolls */}
      <div className={cn('flex min-h-0 flex-1 flex-col pt-2', pad)}>
        <SectionLabel
          collapsed={collapsed}
          action={
            isOwner && (
              <button
                onClick={shell.openCategoryDialog}
                aria-label="New category"
                title="New category"
                className="grid size-5 place-items-center rounded text-fg-faint opacity-0 group-hover/label:opacity-100 hover:bg-hover hover:text-fg focus-visible:opacity-100"
              >
                <Plus className="size-3.5" />
              </button>
            )
          }
        >
          Library
        </SectionLabel>
        <nav aria-label="Library" className="sidebar-scroll scroll-fade min-h-0 flex-1 space-y-px overflow-y-auto overscroll-contain py-0.5">
          {visibleCategories.map((c) => (
            <NavItem
              key={c.id}
              to={`/category/${c.slug}`}
              icon={categoryIcon(c.icon)}
              label={c.name}
              count={counts.byCategory.get(c.id)}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
          {!collapsed && visibleCategories.length === 0 && (
            <p className="px-2.5 py-1.5 text-[13px] text-fg-faint">No categories yet</p>
          )}
        </nav>
      </div>

      {/* Personal */}
      {isOwner && (
        <nav aria-label="Personal" className={cn('shrink-0 space-y-px pt-2', pad)}>
          <SectionLabel collapsed={collapsed}>Personal</SectionLabel>
          <NavItem to="/drafts" icon={PenLine} label="Drafts" count={counts.drafts} collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem to="/archive" icon={Archive} label="Archived" count={counts.archived} collapsed={collapsed} onNavigate={onNavigate} />
        </nav>
      )}

      {/* Footer: one primary action + quiet icons */}
      <div className={cn('mt-3 flex shrink-0 gap-1', collapsed ? 'flex-col items-center px-0' : 'items-center px-2')}>
        {isOwner ? (
          collapsed ? (
            <Tooltip label="New note (N)">
              <button
                onClick={() => navigate('/new')}
                aria-label="New note"
                className="grid size-9 place-items-center rounded-lg bg-fg text-bg transition-opacity duration-150 hover:opacity-85"
              >
                <Plus className="size-4" />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={() => {
                onNavigate?.()
                navigate('/new')
              }}
              title="New note (N)"
              className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-fg text-[13.5px] font-medium text-bg transition-opacity duration-150 hover:opacity-85"
            >
              <Plus className="size-4" />
              New note
            </button>
          )
        ) : (
          <div className={collapsed ? '' : 'min-w-0 flex-1'}>
            <NavItem to="/login" icon={LogIn} label="Sign in" collapsed={collapsed} onNavigate={onNavigate} />
          </div>
        )}
        {isOwner && (
          <IconAction
            label="Settings"
            onClick={() => {
              onNavigate?.()
              navigate('/settings')
            }}
          >
            <Settings className="size-4" />
          </IconAction>
        )}
        <IconAction label={themeLabel} onClick={cycleTheme}>
          <ThemeIcon className="size-4" />
        </IconAction>
      </div>
    </div>
  )
}
