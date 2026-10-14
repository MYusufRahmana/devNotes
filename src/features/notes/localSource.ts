import type { Attachment, AuthUser, Category, Note, NoteSummary } from '@/types'
import { slugify } from '@/lib/markdown'
import { uid } from '@/lib/utils'
import { DEFAULT_CATEGORIES, SAMPLE_NOTES } from '@/lib/seed'
import { rankNotes } from '@/features/search/rank'
import { derived, normalizeTags, type DataSource } from './dataSource'

/**
 * Demo mode: everything lives in this browser.
 * Metadata → localStorage, file blobs → IndexedDB.
 */

const STORE_KEY = 'devnotes:local:v1'
const SESSION_KEY = 'devnotes:local:session'
const DEMO_USER: AuthUser = { id: 'local-owner', email: 'demo@devnotes.local' }
export const LOCAL_IMAGE_PROTOCOL = 'local-image://'

interface Store {
  notes: Note[]
  categories: Category[]
  attachments: Attachment[]
}

// ── IndexedDB blob store ─────────────────────────────────────
let dbPromise: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('devnotes', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('files')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await db()
  return new Promise((resolve, reject) => {
    const req = run(database.transaction('files', mode).objectStore('files'))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const blobStore = {
  put: (key: string, blob: Blob) => idb('readwrite', (s) => s.put(blob, key)),
  get: (key: string) => idb<Blob | undefined>('readonly', (s) => s.get(key)),
  remove: (key: string) => idb('readwrite', (s) => s.delete(key)),
}

const blobUrlCache = new Map<string, string>()
export async function resolveLocalImage(src: string): Promise<string | null> {
  const key = src.slice(LOCAL_IMAGE_PROTOCOL.length)
  const cached = blobUrlCache.get(key)
  if (cached) return cached
  const blob = await blobStore.get(key)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  blobUrlCache.set(key, url)
  return url
}

// ── Persistence ──────────────────────────────────────────────
function now() {
  return new Date().toISOString()
}

function seed(): Store {
  const t = Date.now()
  const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
    id: uid(),
    name: c.name,
    slug: slugify(c.name),
    description: c.description ?? null,
    icon: c.icon,
    sort_order: i,
    created_at: now(),
    updated_at: now(),
  }))
  const bySlug = new Map(categories.map((c) => [c.name, c.id]))
  const notes: Note[] = SAMPLE_NOTES.map((s) => {
    const at = new Date(t - s.daysAgo * 86400000).toISOString()
    return {
      id: uid(),
      title: s.title,
      slug: slugify(s.title),
      content_markdown: s.content,
      excerpt: derived({ content_markdown: s.content }).excerpt ?? null,
      reading_time: derived({ content_markdown: s.content }).reading_time ?? 1,
      note_type: s.type,
      status: s.status,
      visibility: s.visibility,
      is_pinned: Boolean(s.pinned),
      is_favorite: Boolean(s.favorite),
      category_id: bySlug.get(s.category) ?? null,
      tags: normalizeTags(s.tags),
      created_at: at,
      updated_at: at,
      published_at: s.status === 'PUBLISHED' ? at : null,
      archived_at: null,
      cover_image: null,
    }
  })
  return { notes, categories, attachments: [] }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    /* fall through to seed */
  }
  const fresh = seed()
  save(fresh)
  return fresh
}

function save(store: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    throw new Error('Browser storage is full. Export your notes and connect Supabase for larger libraries.')
  }
}

function summary(note: Note): NoteSummary {
  const { content_markdown: _c, ...rest } = note
  void _c
  return rest
}

function isPublic(note: Note) {
  return note.visibility === 'PUBLIC' && note.status === 'PUBLISHED'
}

const delay = () => new Promise((r) => setTimeout(r, 60))

export function createLocalSource(): DataSource {
  let store = load()
  const listeners = new Set<(u: AuthUser | null) => void>()
  const signedIn = () => localStorage.getItem(SESSION_KEY) === '1'
  const commit = () => save(store)

  // Keep multiple tabs consistent.
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY) store = load()
    if (e.key === SESSION_KEY) listeners.forEach((cb) => cb(signedIn() ? DEMO_USER : null))
  })

  function requireOwner() {
    if (!signedIn()) throw new Error('You need to sign in first.')
  }

  function visible(note: Note) {
    return signedIn() || isPublic(note)
  }

  function uniqueSlug(base: string, id: string) {
    const root = slugify(base)
    let candidate = root
    let n = 1
    while (store.notes.some((x) => x.slug === candidate && x.id !== id)) candidate = `${root}-${++n}`
    return candidate
  }

  function find(id: string) {
    const note = store.notes.find((n) => n.id === id)
    if (!note) throw new Error('Note not found')
    return note
  }

  const source: DataSource = {
    mode: 'local',

    async getUser() {
      return signedIn() ? DEMO_USER : null
    },

    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },

    async signIn() {
      localStorage.setItem(SESSION_KEY, '1')
      listeners.forEach((cb) => cb(DEMO_USER))
    },

    async signOut() {
      localStorage.removeItem(SESSION_KEY)
      listeners.forEach((cb) => cb(null))
    },

    async listNotes() {
      await delay()
      return store.notes
        .filter(visible)
        .map(summary)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    },

    async getNote({ id, slug }) {
      await delay()
      const note = store.notes.find((n) => (id ? n.id === id : n.slug === slug))
      return note && visible(note) ? structuredClone(note) : null
    },

    async createNote(input, tags) {
      requireOwner()
      const id = uid()
      const t = now()
      const note: Note = {
        id,
        title: input.title.trim() || 'Untitled',
        slug: uniqueSlug(input.slug || input.title, id),
        content_markdown: input.content_markdown,
        excerpt: null,
        reading_time: 1,
        ...derived(input),
        note_type: input.note_type,
        category_id: input.category_id,
        status: input.status,
        visibility: input.visibility,
        is_pinned: false,
        is_favorite: false,
        tags: normalizeTags(tags),
        created_at: t,
        updated_at: t,
        published_at: input.status === 'PUBLISHED' ? t : null,
        archived_at: input.status === 'ARCHIVED' ? t : null,
        cover_image: input.cover_image ?? null,
      }
      store.notes.push(note)
      commit()
      return structuredClone(note)
    },

    async updateNote(id, patch) {
      requireOwner()
      const note = find(id)
      const contentKeys = ['title', 'content_markdown', 'note_type', 'category_id', 'visibility', 'status', 'slug', 'cover_image'] as const
      const contentChanged = contentKeys.some((k) => patch[k] !== undefined && patch[k] !== note[k])

      Object.assign(note, patch, derived(patch))
      if (patch.title !== undefined) note.title = patch.title.trim() || 'Untitled'
      if (patch.slug !== undefined) note.slug = uniqueSlug(patch.slug || note.title, id)
      if (note.status === 'PUBLISHED' && !note.published_at) note.published_at = now()
      if (note.status === 'ARCHIVED') note.archived_at ??= now()
      else note.archived_at = null
      if (contentChanged) note.updated_at = now()
      commit()
      return structuredClone(note)
    },

    async setTags(noteId, tags) {
      requireOwner()
      find(noteId).tags = normalizeTags(tags)
      commit()
    },

    async deleteNote(id) {
      requireOwner()
      const files = store.attachments.filter((a) => a.note_id === id)
      await Promise.all(files.map((a) => blobStore.remove(a.storage_path)))
      store.attachments = store.attachments.filter((a) => a.note_id !== id)
      store.notes = store.notes.filter((n) => n.id !== id)
      commit()
    },

    async search(q, options = {}) {
      return rankNotes(store.notes.filter(visible), store.categories, q, options)
    },

    async listCategories() {
      const cats = signedIn()
        ? store.categories
        : store.categories.filter((c) => store.notes.some((n) => n.category_id === c.id && isPublic(n)))
      return [...cats].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    },

    async createCategory(input) {
      requireOwner()
      const slug = slugify(input.name)
      if (store.categories.some((c) => c.slug === slug)) throw new Error(`A category named “${input.name}” already exists.`)
      const category: Category = {
        id: uid(),
        name: input.name.trim(),
        slug,
        description: input.description ?? null,
        icon: input.icon ?? null,
        sort_order: Math.max(-1, ...store.categories.map((c) => c.sort_order)) + 1,
        created_at: now(),
        updated_at: now(),
      }
      store.categories.push(category)
      commit()
      return category
    },

    async updateCategory(id, input) {
      requireOwner()
      const category = store.categories.find((c) => c.id === id)
      if (!category) throw new Error('Category not found')
      if (input.name) {
        const slug = slugify(input.name)
        if (store.categories.some((c) => c.slug === slug && c.id !== id))
          throw new Error(`A category named “${input.name}” already exists.`)
        category.name = input.name.trim()
        category.slug = slug
      }
      if (input.description !== undefined) category.description = input.description
      if (input.icon !== undefined) category.icon = input.icon
      if (input.sort_order !== undefined) category.sort_order = input.sort_order
      category.updated_at = now()
      commit()
      return { ...category }
    },

    async deleteCategory(id) {
      requireOwner()
      store.categories = store.categories.filter((c) => c.id !== id)
      store.notes.forEach((n) => {
        if (n.category_id === id) n.category_id = null
      })
      commit()
    },

    async uploadImage(_noteId, file) {
      requireOwner()
      const key = `img-${uid()}`
      await blobStore.put(key, file)
      return `${LOCAL_IMAGE_PROTOCOL}${key}`
    },

    async listAttachments(noteId) {
      return store.attachments.filter((a) => a.note_id === noteId)
    },

    async uploadAttachment(noteId, file, mime) {
      requireOwner()
      const attachment: Attachment = {
        id: uid(),
        note_id: noteId,
        file_name: file.name,
        storage_path: `att-${uid()}`,
        mime_type: mime,
        file_size: file.size,
        created_at: now(),
      }
      await blobStore.put(attachment.storage_path, file)
      store.attachments.push(attachment)
      commit()
      return attachment
    },

    async deleteAttachment(attachment) {
      requireOwner()
      await blobStore.remove(attachment.storage_path)
      store.attachments = store.attachments.filter((a) => a.id !== attachment.id)
      commit()
    },

    async attachmentUrl(attachment) {
      const blob = await blobStore.get(attachment.storage_path)
      if (!blob) throw new Error('File is missing from this browser.')
      return URL.createObjectURL(new Blob([blob], { type: attachment.mime_type }))
    },
  }
  return source
}
