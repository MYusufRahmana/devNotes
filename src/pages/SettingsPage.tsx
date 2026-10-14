import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Download, FileUp, LogOut, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { Category } from '@/types'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { CategoryDialog } from '@/features/categories/CategoryDialog'
import { categoryIcon } from '@/features/categories/icons'
import { useCategories, useCategoryActions, useCounts } from '@/features/notes/hooks'
import { exportAll, importMarkdownFiles } from '@/features/notes/portability'
import { useTheme, type ReaderFont, type Theme } from '@/features/theme/ThemeProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn, errorMessage } from '@/lib/utils'

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line-soft py-8 first:border-t-0 first:pt-2">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line p-0.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'h-7 rounded px-3 text-[13px] transition-colors duration-150',
            value === v ? 'bg-active font-medium text-fg' : 'text-fg-muted hover:text-fg',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export function SettingsPage() {
  useDocumentTitle('Settings')
  const { user, mode, signOut } = useAuth()
  const { theme, setTheme, readerFont, setReaderFont } = useTheme()
  const { data: categories = [] } = useCategories()
  const counts = useCounts()
  const { update, remove } = useCategoryActions()
  const confirm = useConfirm()
  const toast = useToast()
  const qc = useQueryClient()

  const [dialog, setDialog] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null })
  const [exporting, setExporting] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView()
  }, [])

  async function move(index: number, dir: -1 | 1) {
    const list = [...categories]
    const target = index + dir
    if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    // Re-number everything so the order is always well-defined.
    await Promise.all(
      list.map((c, i) => (c.sort_order === i ? null : update.mutateAsync({ id: c.id, input: { sort_order: i } }))),
    )
  }

  async function runExport() {
    setExporting('Preparing…')
    try {
      const n = await exportAll(categories, (done, total) => setExporting(`${done} / ${total}`))
      toast.success(`Exported ${n} notes`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setExporting(null)
    }
  }

  async function runImport(files: File[]) {
    const md = files.filter((f) => /\.(md|markdown|txt)$/i.test(f.name))
    if (!md.length) return toast.error('Choose .md files to import.')
    setImporting(true)
    try {
      const result = await importMarkdownFiles(md, categories)
      qc.invalidateQueries()
      if (result.imported) toast.success(`Imported ${result.imported} ${result.imported === 1 ? 'note' : 'notes'} as drafts`)
      result.failed.forEach((f) => toast.error(`${f.file}: ${f.error}`))
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <AppHeader crumbs={[{ label: 'Settings' }]} />
      <div className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-24 md:px-8">
        <h1 className="mb-6 text-[26px] font-semibold tracking-[-0.02em]">Settings</h1>

        <Section title="Appearance">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-[13px] text-fg-muted">System follows your OS setting.</p>
              </div>
              <Segmented<Theme>
                label="Theme"
                value={theme}
                onChange={setTheme}
                options={[
                  ['system', 'System'],
                  ['light', 'Light'],
                  ['dark', 'Dark'],
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Reading font</p>
                <p className="text-[13px] text-fg-muted">Serif reads like Medium; sans reads like docs.</p>
              </div>
              <Segmented<ReaderFont>
                label="Reading font"
                value={readerFont}
                onChange={setReaderFont}
                options={[
                  ['sans', 'Sans'],
                  ['serif', 'Serif'],
                ]}
              />
            </div>
          </div>
        </Section>

        <Section title="Categories" description="Shown in the sidebar Library, in this order.">
          <ul className="divide-y divide-line-soft rounded-lg border border-line">
            {categories.map((c, i) => {
              const Icon = categoryIcon(c.icon)
              const count = counts.byCategory.get(c.id) ?? 0
              return (
                <li key={c.id} className="group flex items-center gap-3 px-3 py-2">
                  <Icon className="size-4 shrink-0 text-fg-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    {c.description && <p className="truncate text-[12.5px] text-fg-muted">{c.description}</p>}
                  </div>
                  <span className="text-xs text-fg-faint tabular-nums">{count}</span>
                  <div className="flex items-center opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <IconAction label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp className="size-3.5" />
                    </IconAction>
                    <IconAction label="Move down" onClick={() => move(i, 1)} disabled={i === categories.length - 1}>
                      <ArrowDown className="size-3.5" />
                    </IconAction>
                    <IconAction label="Edit" onClick={() => setDialog({ open: true, category: c })}>
                      <Pencil className="size-3.5" />
                    </IconAction>
                    <IconAction
                      label="Delete"
                      danger
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Delete “${c.name}”?`,
                          description: count ? `${count} notes will remain without a category.` : undefined,
                          confirmLabel: 'Delete',
                          danger: true,
                        })
                        if (ok) remove.mutate(c)
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </IconAction>
                  </div>
                </li>
              )
            })}
            {categories.length === 0 && <li className="px-3 py-4 text-sm text-fg-muted">No categories yet.</li>}
          </ul>
          <Button size="sm" className="mt-3" onClick={() => setDialog({ open: true, category: null })}>
            <Plus className="size-3.5" /> New category
          </Button>
        </Section>

        <Section id="import" title="Backup & import" description="Your notes are plain Markdown — take them anywhere.">
          <div className="flex flex-wrap gap-2">
            <Button onClick={runExport} loading={Boolean(exporting)}>
              <Download className="size-4" /> {exporting ? `Exporting ${exporting}` : 'Export all notes (.zip)'}
            </Button>
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              runImport(Array.from(e.dataTransfer.files))
            }}
            className={cn(
              'mt-4 flex flex-col items-center rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-150',
              dragOver ? 'border-accent bg-accent-soft' : 'border-line',
            )}
          >
            <FileUp className="size-5 text-fg-faint" />
            <p className="mt-2 text-sm font-medium">Import Markdown files</p>
            <p className="mt-0.5 max-w-sm text-[13px] text-fg-muted">
              Drop .md files here. Title, type, category and tags are read from frontmatter, then the first heading, then
              the file name.
            </p>
            <Button size="sm" className="mt-4" loading={importing} onClick={() => fileRef.current?.click()}>
              Choose files
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,.txt,text/markdown"
              multiple
              hidden
              onChange={(e) => {
                runImport(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
          </div>
        </Section>

        <Section title="Account">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium">{user?.email}</p>
              <p className="text-[13px] text-fg-muted">
                {mode === 'supabase' ? 'Synced with Supabase · protected by row-level security' : 'Demo mode · stored in this browser'}
              </p>
            </div>
            <div className="flex gap-2">
              {mode === 'local' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Reset demo data?',
                      description: 'All notes in this browser are replaced with the sample notes.',
                      confirmLabel: 'Reset',
                      danger: true,
                    })
                    if (ok) {
                      localStorage.removeItem('devnotes:local:v1')
                      location.reload()
                    }
                  }}
                >
                  <RotateCcw className="size-3.5" /> Reset demo
                </Button>
              )}
              <Button size="sm" onClick={signOut}>
                <LogOut className="size-3.5" /> Sign out
              </Button>
            </div>
          </div>
        </Section>
      </div>
      <CategoryDialog open={dialog.open} category={dialog.category} onClose={() => setDialog({ open: false, category: null })} />
    </>
  )
}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'grid size-7 place-items-center rounded-md text-fg-faint hover:bg-hover disabled:opacity-30',
        danger ? 'hover:text-danger' : 'hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}
