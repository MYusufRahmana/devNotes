import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Check,
  Columns2,
  Eye,
  Globe2,
  Lock,
  MoreHorizontal,
  PenLine,
  Archive,
  Download,
  FolderOpen,
  Plus,
  Undo2,
} from 'lucide-react'
import type { Note, NotePatch, NoteStatus, NoteType, Visibility } from '@/types'
import { NOTE_TYPES } from '@/types'
import { AppHeader } from '@/components/layout/AppHeader'
import { CoverEditor } from '@/components/editor/CoverEditor'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { NoteEditor, type NoteEditorHandle } from '@/components/editor/NoteEditor'
import { TagInput } from '@/components/editor/TagInput'
import { TemplatePicker } from '@/components/editor/TemplatePicker'
import { Markdown } from '@/components/notes/Markdown'
import { AttachmentList } from '@/components/notes/AttachmentList'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { ErrorState, Skeleton } from '@/components/ui/misc'
import { Select } from '@/components/ui/Select'
import { categoryIcon } from '@/features/categories/icons'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Dialog'
import { CategoryDialog } from '@/features/categories/CategoryDialog'
import { keys, useCategories, useCounts, useNote, usePutNoteInCache } from '@/features/notes/hooks'
import { exportNote } from '@/features/notes/portability'
import { source } from '@/features/notes/source'
import { COVER_MIGRATION_HINT } from '@/features/notes/supabaseSource'
import { useTheme } from '@/features/theme/ThemeProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useHotkey } from '@/hooks/useHotkey'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { NOTE_TYPE_META } from '@/lib/noteTypes'
import { TEMPLATES, isUntouchedTemplate, templateFor, type TemplateKey } from '@/lib/templates'
import { slugify, stripDuplicateTitle } from '@/lib/markdown'
import { ATTACHMENT_ACCEPT, IMAGE_TYPES, validateAttachment } from '@/lib/uploads'
import { relativeTime } from '@/lib/date'
import { cn, errorMessage, modKey } from '@/lib/utils'
import { NotFoundPage } from './NotFoundPage'

// ─────────────────────────────────────────────────────────────
// Draft model
// ─────────────────────────────────────────────────────────────
interface Draft {
  title: string
  content: string
  note_type: NoteType
  category_id: string | null
  visibility: Visibility
  status: NoteStatus
  tags: string[]
  cover_image: string | null
}

type SaveState = 'saved' | 'unsaved' | 'saving' | 'error'
type View = 'write' | 'preview' | 'split'

const AUTOSAVE_MS = 1000

function fromNote(n: Note): Draft {
  return {
    title: n.title === 'Untitled' ? '' : n.title,
    content: n.content_markdown,
    note_type: n.note_type,
    category_id: n.category_id,
    visibility: n.visibility,
    status: n.status,
    tags: n.tags,
    cover_image: n.cover_image ?? null,
  }
}

const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i])

function sameDraft(a: Draft, b: Draft) {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.note_type === b.note_type &&
    a.category_id === b.category_id &&
    a.visibility === b.visibility &&
    a.status === b.status &&
    a.cover_image === b.cover_image &&
    sameTags(a.tags, b.tags)
  )
}

// Local crash-safety backup, separate from the server save.
interface Backup {
  draft: Draft
  at: string
}
const backupKey = (id: string) => `devnotes:backup:${id}`
function writeBackup(id: string, draft: Draft) {
  try {
    localStorage.setItem(backupKey(id), JSON.stringify({ draft, at: new Date().toISOString() } satisfies Backup))
  } catch {
    /* storage full — server autosave still runs */
  }
}
function readBackup(id: string): Backup | null {
  try {
    const raw = localStorage.getItem(backupKey(id))
    return raw ? (JSON.parse(raw) as Backup) : null
  } catch {
    return null
  }
}
function clearBackup(id: string) {
  try {
    localStorage.removeItem(backupKey(id))
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export function EditorPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const putInCache = usePutNoteInCache()
  const { readerFont } = useTheme()
  const { data: categories = [] } = useCategories()
  const counts = useCounts()
  const isWide = useMediaQuery('(min-width: 1024px)')
  const noteQuery = useNote({ id })

  const [draft, setDraftState] = useState<Draft | null>(null)
  const [picking, setPicking] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [noteId, setNoteId] = useState<string | null>(id ?? null)
  const [backup, setBackup] = useState<Backup | null>(null)
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [viewPref, setViewPref] = useLocalStorage<View>('devnotes:editor-view', 'write')
  const view: View = viewPref === 'split' && !isWide ? 'write' : viewPref

  const draftRef = useRef<Draft | null>(null)
  const savedRef = useRef<Draft | null>(null)
  const noteIdRef = useRef<string | null>(id ?? null)
  const publishedAtRef = useRef<string | null>(null)
  const loadedFor = useRef<string | null>(null)
  const templateRef = useRef('')
  const forceCreate = useRef(false)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const pending = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const editorRef = useRef<NoteEditorHandle>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useDocumentTitle(draft ? `Editing ${draft.title || 'Untitled'}` : 'New note')

  const setDraft = (d: Draft) => {
    draftRef.current = d
    setDraftState(d)
  }

  // ── Initialise from route ───────────────────────────────
  const start = useCallback(
    (key: TemplateKey) => {
      const { type, content } = templateFor(key)
      const catSlug = params.get('category')
      const category = catSlug ? categories.find((c) => c.slug === catSlug) : undefined
      templateRef.current = content
      savedRef.current = null
      setDraft({
        title: '',
        content,
        note_type: type,
        category_id: category?.id ?? null,
        visibility: 'PRIVATE',
        status: 'DRAFT',
        tags: [],
        cover_image: null,
      })
      setPicking(false)
      setSaveState('saved')
      requestAnimationFrame(() => titleRef.current?.focus())
    },
    [params, categories],
  )

  useEffect(() => {
    const routeKey = id ?? 'new'
    if (loadedFor.current === routeKey) return

    if (id) {
      if (noteQuery.isPending || !noteQuery.data) return
      const note = noteQuery.data
      const d = fromNote(note)
      loadedFor.current = id
      noteIdRef.current = id
      setNoteId(id)
      savedRef.current = d
      publishedAtRef.current = note.published_at
      setDraft(d)
      setSaveState('saved')
      setPicking(false)
      const b = readBackup(id)
      if (b && b.at > note.updated_at && !sameDraft(b.draft, d)) setBackup(b)
      else clearBackup(id)
    } else {
      loadedFor.current = 'new'
      noteIdRef.current = null
      setNoteId(null)
      publishedAtRef.current = null
      setBackup(null)
      const type = params.get('type')?.toUpperCase()
      if (type && (NOTE_TYPES as readonly string[]).includes(type)) start(type as NoteType)
      else if (params.get('blank') !== null) start('BLANK')
      else {
        setDraftState(null)
        draftRef.current = null
        setPicking(true)
      }
    }
  }, [id, noteQuery.isPending, noteQuery.data, params, start])

  // ── Persistence ─────────────────────────────────────────
  const persist = useCallback(async (): Promise<boolean> => {
    const d = draftRef.current
    if (!d) return true
    const saved = savedRef.current
    if (saved && sameDraft(d, saved)) {
      setSaveState('saved')
      return true
    }

    const currentId = noteIdRef.current
    const pristine =
      !d.title.trim() && d.content.trim() === templateRef.current.trim() && d.tags.length === 0 && !d.cover_image
    if (!currentId && pristine && !forceCreate.current) {
      setSaveState('saved')
      return true
    }

    setSaveState('saving')
    try {
      let note: Note
      const created = !currentId
      if (!currentId) {
        note = await source.createNote(
          {
            title: d.title,
            content_markdown: d.content,
            note_type: d.note_type,
            category_id: d.category_id,
            visibility: d.visibility,
            status: d.status,
            cover_image: d.cover_image,
          },
          d.tags,
        )
        noteIdRef.current = note.id
        loadedFor.current = note.id
        forceCreate.current = false
        setNoteId(note.id)
        clearBackup('new')
      } else {
        const patch: NotePatch = {}
        if (!saved || d.title !== saved.title) {
          patch.title = d.title
          // Links stay stable once a note has been published.
          if (!publishedAtRef.current) patch.slug = slugify(d.title || 'untitled')
        }
        if (!saved || d.content !== saved.content) patch.content_markdown = d.content
        if (!saved || d.note_type !== saved.note_type) patch.note_type = d.note_type
        if (!saved || d.category_id !== saved.category_id) patch.category_id = d.category_id
        if (!saved || d.visibility !== saved.visibility) patch.visibility = d.visibility
        if (!saved || d.status !== saved.status) patch.status = d.status
        if (!saved || d.cover_image !== saved.cover_image) patch.cover_image = d.cover_image
        const tagsChanged = !saved || !sameTags(d.tags, saved.tags)

        let result: Note | null = null
        if (Object.keys(patch).length) result = await source.updateNote(currentId, patch)
        if (tagsChanged) {
          await source.setTags(currentId, d.tags)
          result = await source.getNote({ id: currentId })
        }
        if (!result) throw new Error('Note not found')
        note = result
      }

      savedRef.current = d
      publishedAtRef.current = note.published_at
      putInCache(note)
      qc.invalidateQueries({ queryKey: ['search'] })
      if (created) navigate(`/edit/${note.id}`, { replace: true })
      setSaveError(null)

      if (draftRef.current === d) {
        setSaveState('saved')
        clearBackup(note.id)
      } else {
        pending.current = true
      }
      return true
    } catch (e) {
      setSaveState('error')
      setSaveError(errorMessage(e))
      return false
    }
  }, [navigate, putInCache, qc])

  /** Serialised save: never two requests at once, and nothing is lost in between. */
  const flush = useCallback((): Promise<boolean> => {
    window.clearTimeout(timer.current)
    if (inFlight.current) {
      pending.current = true
      return inFlight.current
    }
    const run = (async () => {
      let ok = true
      do {
        pending.current = false
        ok = await persist()
      } while (ok && pending.current)
      return ok
    })()
    inFlight.current = run
    run.finally(() => {
      inFlight.current = null
    })
    return run
  }, [persist])

  const change = useCallback(
    (patch: Partial<Draft>) => {
      const current = draftRef.current
      if (!current) return
      const next = { ...current, ...patch }
      setDraft(next)
      setSaveState('unsaved')
      writeBackup(noteIdRef.current ?? 'new', next)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, AUTOSAVE_MS)
    },
    [flush],
  )

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function ensureNoteId(): Promise<string> {
    if (noteIdRef.current) return noteIdRef.current
    forceCreate.current = true
    await flush()
    if (!noteIdRef.current) throw new Error('Could not create the note. Check your connection.')
    return noteIdRef.current
  }

  // ── Leaving the page ────────────────────────────────────
  const dirty = saveState !== 'saved'
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      currentLocation.pathname !== nextLocation.pathname &&
      nextLocation.pathname !== `/edit/${noteIdRef.current}`,
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    flush().then(async (ok) => {
      if (ok) return blocker.proceed()
      const leave = await confirm({
        title: 'Leave without saving?',
        description: 'The last changes could not be saved. A local copy is kept and will be offered next time.',
        confirmLabel: 'Leave',
        danger: true,
      })
      if (leave) blocker.proceed()
      else blocker.reset()
    })
  }, [blocker, flush, confirm])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      flush()
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty, flush])

  // ── Actions ─────────────────────────────────────────────
  async function saveNow() {
    if (!draftRef.current) return
    if (!noteIdRef.current) forceCreate.current = true
    if (await flush()) toast.success('Saved')
  }

  async function publish() {
    const d = draftRef.current
    if (!d) return
    if (!d.title.trim()) {
      toast.error('Add a title before publishing.')
      titleRef.current?.focus()
      return
    }
    const previous = d.status
    change({ status: 'PUBLISHED' })
    forceCreate.current = true
    if (await flush()) {
      toast.success(d.visibility === 'PUBLIC' ? 'Published publicly' : 'Published (private)')
      openReader()
    } else {
      // Keep the other edits, but go back to the real status.
      const current = draftRef.current
      if (current) setDraft({ ...current, status: previous })
      toast.error('Publishing failed. Your changes are kept — try again.')
    }
  }

  async function revertToDraft() {
    change({ status: 'DRAFT' })
    if (await flush()) toast.success('Moved back to drafts')
    else {
      const current = draftRef.current
      if (current) setDraft({ ...current, status: 'PUBLISHED' })
    }
  }

  async function archive() {
    if (!noteIdRef.current) return navigate('/')
    change({ status: 'ARCHIVED' })
    if (await flush()) {
      toast.success('Archived')
      navigate('/archive')
    }
  }

  function openReader() {
    const slug = qc.getQueryData<Note>(keys.note(`id:${noteIdRef.current}`))?.slug
    navigate(slug ? `/notes/${slug}` : '/notes')
  }

  function back() {
    if (noteIdRef.current && savedRef.current) openReader()
    else navigate(-1)
  }

  function changeType(type: NoteType) {
    const d = draftRef.current
    if (!d) return
    // Swap the template only if the user hasn't written anything yet.
    if (isUntouchedTemplate(d.content)) {
      templateRef.current = TEMPLATES[type]
      change({ note_type: type, content: TEMPLATES[type] })
    } else change({ note_type: type })
  }

  async function uploadImage(file: File) {
    const nid = await ensureNoteId()
    return source.uploadImage(nid, file)
  }

  async function uploadAttachments(files: File[]) {
    if (!files.length) return
    let nid: string
    try {
      nid = await ensureNoteId()
    } catch (e) {
      return toast.error(errorMessage(e))
    }
    let uploaded = 0
    for (const file of files) {
      const check = validateAttachment(file)
      if ('error' in check) {
        toast.error(check.error)
        continue
      }
      try {
        await source.uploadAttachment(nid, file, check.mime)
        uploaded++
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e)}`)
      }
    }
    if (uploaded) {
      qc.invalidateQueries({ queryKey: keys.attachments(nid) })
      toast.success(uploaded === 1 ? 'File attached' : `${uploaded} files attached`)
    }
  }

  // ── Shortcuts ───────────────────────────────────────────
  useHotkey('mod+s', (e) => {
    e.preventDefault()
    saveNow()
  })
  useHotkey('mod+enter', (e) => {
    e.preventDefault()
    if (draftRef.current?.status !== 'PUBLISHED') publish()
    else saveNow().then(openReader)
  })
  useHotkey('mod+shift+p', (e) => {
    e.preventDefault()
    setViewPref(view === 'preview' ? 'write' : 'preview')
  })
  useHotkey('escape', () => !picking && back(), { allowInInputs: true, enabled: !categoryDialog })

  // Auto-grow title
  useEffect(() => {
    const t = titleRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${t.scrollHeight}px`
  }, [draft?.title, view])

  const words = useMemo(() => (draft?.content.match(/\S+/g) ?? []).length, [draft?.content])
  const tagSuggestions = useMemo(() => counts.tags.map((t) => t.name), [counts.tags])

  // ── Render ──────────────────────────────────────────────
  if (id && noteQuery.isPending) return <EditorSkeleton />
  if (id && noteQuery.error) return <ErrorState message={`Failed to load note. ${errorMessage(noteQuery.error)}`} onRetry={() => noteQuery.refetch()} />
  if (id && !noteQuery.data && loadedFor.current !== id) return <NotFoundPage what="note" />

  if (picking) {
    return (
      <>
        <AppHeader crumbs={[{ label: 'New note' }]} onBack={() => navigate(-1)} />
        <TemplatePicker onPick={start} />
      </>
    )
  }
  if (!draft) return <EditorSkeleton />

  const category = categories.find((c) => c.id === draft.category_id)
  const isPublished = draft.status === 'PUBLISHED'
  const VisIcon = draft.visibility === 'PUBLIC' ? Globe2 : Lock

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        onBack={back}
        crumbs={[
          category ? { label: category.name, to: `/category/${category.slug}` } : { label: 'Notes', to: '/notes' },
          { label: draft.title || 'Untitled' },
        ]}
        actions={
          <>
            <SaveIndicator state={saveState} error={saveError} onRetry={flush} />
            <div className="ml-1 hidden items-center rounded-md border border-line p-0.5 sm:flex" role="group" aria-label="View">
              {(
                [
                  ['write', PenLine, 'Write'],
                  ['split', Columns2, 'Split'],
                  ['preview', Eye, 'Preview'],
                ] as const
              )
                .filter(([v]) => v !== 'split' || isWide)
                .map(([v, Icon, label]) => (
                  <button
                    key={v}
                    onClick={() => setViewPref(v)}
                    aria-pressed={view === v}
                    title={v === 'preview' ? `${label} (${modKey}+Shift+P)` : label}
                    className={cn(
                      'grid h-7 w-8 place-items-center rounded text-fg-muted transition-colors duration-150',
                      view === v ? 'bg-active text-fg' : 'hover:text-fg',
                    )}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
            </div>
            <button
              onClick={() => setViewPref(view === 'preview' ? 'write' : 'preview')}
              className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-hover sm:hidden"
              aria-label={view === 'preview' ? 'Write' : 'Preview'}
            >
              {view === 'preview' ? <PenLine className="size-4" /> : <Eye className="size-4" />}
            </button>
            <Menu
              items={[
                ...(isPublished ? [{ label: 'Revert to draft', icon: Undo2, onSelect: revertToDraft }] : []),
                {
                  label: 'Export as Markdown',
                  icon: Download,
                  disabled: !noteId,
                  onSelect: async () => {
                    await flush()
                    const n = noteIdRef.current ? await source.getNote({ id: noteIdRef.current }) : null
                    if (n) exportNote(n, category)
                  },
                },
                'separator',
                { label: noteId ? 'Archive' : 'Discard', icon: Archive, onSelect: archive },
              ]}
              trigger={(p) => (
                <button {...p} aria-label="More actions" className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-hover">
                  <MoreHorizontal className="size-4" />
                </button>
              )}
            />
          </>
        }
      />

      {backup && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-warning/20 bg-warning/8 px-4 py-2 text-[13px]">
          <span>Unsaved changes from {relativeTime(backup.at)} were recovered on this device.</span>
          <button
            className="font-medium underline underline-offset-2"
            onClick={() => {
              change(backup.draft)
              setBackup(null)
            }}
          >
            Restore
          </button>
          <button
            className="text-fg-muted hover:text-fg"
            onClick={() => {
              if (noteIdRef.current) clearBackup(noteIdRef.current)
              setBackup(null)
            }}
          >
            Discard
          </button>
        </div>
      )}

      <div className={cn('mx-auto w-full flex-1 px-4 pt-8 pb-10 md:px-8', view === 'split' ? 'max-w-[1440px]' : 'max-w-[800px]')}>
        {/* Title + properties */}
        <div className={cn(view === 'split' && 'max-w-[740px]')}>
          {source.supportsCovers?.() === false ? (
            <p className="mb-2 text-[12.5px] text-fg-faint" title={COVER_MIGRATION_HINT}>
              Covers are off: run <code className="rounded bg-subtle px-1">0002_cover_image.sql</code> in Supabase to enable them.
            </p>
          ) : (
            <div className={cn(draft.cover_image ? 'mb-6' : '-ml-2 mb-1')}>
              <CoverEditor
                value={draft.cover_image}
                onChange={(cover_image) => change({ cover_image })}
                onUpload={uploadImage}
                onError={toast.error}
              />
            </div>
          )}
          <textarea
            ref={titleRef}
            value={draft.title}
            onChange={(e) => change({ title: e.target.value.replace(/\n/g, ' ') })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                editorRef.current?.focus()
              }
            }}
            rows={1}
            maxLength={200}
            placeholder="Title"
            aria-label="Title"
            className="block w-full resize-none overflow-hidden bg-transparent text-[30px] leading-[1.2] font-bold tracking-[-0.022em] outline-none placeholder:text-fg-faint md:text-[34px]"
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Select
              label="Type"
              variant="subtle"
              value={draft.note_type}
              onChange={(v) => changeType(v as NoteType)}
              options={NOTE_TYPES.map((t) => ({ value: t, label: NOTE_TYPE_META[t].label, icon: NOTE_TYPE_META[t].icon }))}
            />
            <Select
              label="Category"
              variant="subtle"
              value={draft.category_id ?? ''}
              onChange={(v) => change({ category_id: v || null })}
              options={[
                { value: '', label: 'No category', icon: FolderOpen },
                ...categories.map((c) => ({ value: c.id, label: c.name, icon: categoryIcon(c.icon) })),
              ]}
              action={{ label: 'New category', icon: Plus, onSelect: () => setCategoryDialog(true) }}
            />
            <div className="flex h-8 items-center gap-0.5 rounded-lg bg-subtle p-0.5" role="radiogroup" aria-label="Visibility">
              {(['PRIVATE', 'PUBLIC'] as const).map((v) => {
                const Icon = v === 'PUBLIC' ? Globe2 : Lock
                return (
                  <button
                    key={v}
                    role="radio"
                    aria-checked={draft.visibility === v}
                    onClick={() => change({ visibility: v })}
                    className={cn(
                      'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors duration-150',
                      draft.visibility === v ? 'bg-surface font-medium text-fg shadow-panel' : 'text-fg-muted hover:text-fg',
                    )}
                  >
                    <Icon className="size-3.5" />
                    {v === 'PUBLIC' ? 'Public' : 'Private'}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-2.5">
            <TagInput value={draft.tags} onChange={(tags) => change({ tags })} suggestions={tagSuggestions} />
          </div>
        </div>

        {/* Toolbar */}
        <div className="sticky top-14 z-10 -mx-2 mt-5 border-y border-line-soft bg-bg px-2 py-1">
          {view === 'preview' ? (
            <p className="flex h-8 items-center text-[13px] text-fg-muted">Preview — this is how readers will see it.</p>
          ) : (
            <EditorToolbar
              getTextarea={() => editorRef.current?.textarea() ?? null}
              onImage={() => imageInput.current?.click()}
              onAttach={() => fileInput.current?.click()}
            />
          )}
        </div>

        {/* Body */}
        <div className={cn('mt-6', view === 'split' && 'grid grid-cols-2 gap-10')}>
          <div className={cn(view === 'preview' && 'hidden')}>
            <NoteEditor
              ref={editorRef}
              value={draft.content}
              onChange={(content) => change({ content })}
              onUploadImage={uploadImage}
              onDropFiles={uploadAttachments}
              onError={toast.error}
            />
          </div>
          {view !== 'write' && (
            <div className={cn(view === 'split' && 'thin-scroll sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto border-l border-line-soft pl-10')}>
              {draft.content.trim() ? (
                <Markdown content={stripDuplicateTitle(draft.content, draft.title)} serif={readerFont === 'serif'} />
              ) : (
                <p className="text-sm text-fg-faint">Nothing to preview yet.</p>
              )}
            </div>
          )}
        </div>

        {noteId && (
          <div className={cn('mt-10', view === 'split' && 'max-w-[740px]')}>
            <AttachmentList noteId={noteId} editable />
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 z-10 border-t border-line-soft bg-bg">
        <div className={cn('mx-auto flex h-14 w-full items-center gap-3 px-4 md:px-8', view === 'split' ? 'max-w-[1440px]' : 'max-w-[800px]')}>
          <Button size="sm" variant="ghost" onClick={saveNow} title={`Save (${modKey}+S)`}>
            {isPublished ? 'Save' : 'Save draft'}
          </Button>
          <span className="hidden text-[12.5px] text-fg-faint tabular-nums sm:inline">
            {words} {words === 1 ? 'word' : 'words'}
          </span>
          <span className="ml-auto hidden items-center gap-1.5 text-[12.5px] text-fg-muted sm:flex">
            <VisIcon className="size-3.5" />
            {draft.visibility === 'PUBLIC' ? 'Anyone with the link' : 'Only you'}
          </span>
          {isPublished ? (
            <Button size="sm" variant="primary" className="ml-auto sm:ml-0" onClick={() => saveNow().then(openReader)}>
              <Check className="size-3.5" /> Done
            </Button>
          ) : (
            <Button size="sm" variant="primary" className="ml-auto sm:ml-0" onClick={publish} title={`Publish (${modKey}+Enter)`}>
              Publish
            </Button>
          )}
        </div>
      </div>

      <input
        ref={imageInput}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        multiple
        hidden
        onChange={(e) => {
          editorRef.current?.insertImages(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          uploadAttachments(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <CategoryDialog open={categoryDialog} onClose={() => setCategoryDialog(false)} onSaved={(c) => change({ category_id: c.id })} />
    </div>
  )
}

function SaveIndicator({ state, error, onRetry }: { state: SaveState; error: string | null; onRetry: () => void }) {
  if (state === 'error') {
    return (
      <button onClick={onRetry} title={error ?? undefined} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-danger hover:bg-hover">
        <AlertCircle className="size-3.5" /> Not saved · Retry
      </button>
    )
  }
  const label = state === 'saving' ? 'Saving…' : state === 'unsaved' ? 'Unsaved changes' : 'Saved'
  return (
    <span aria-live="polite" className={cn('px-1 text-[12.5px] whitespace-nowrap', state === 'saved' ? 'text-fg-faint' : 'text-fg-muted')}>
      {label}
    </span>
  )
}

function EditorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[800px] space-y-4 px-4 pt-24 md:px-8">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-8 w-80" />
      <Skeleton className="mt-8 h-64 w-full" />
    </div>
  )
}
