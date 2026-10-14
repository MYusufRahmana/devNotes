import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Attachment, AuthUser, Category, Note, NoteSummary, SearchHit } from '@/types'
import { slugify } from '@/lib/markdown'
import { sanitizeFileName, uid } from '@/lib/utils'
import { DEFAULT_CATEGORIES } from '@/lib/seed'
import { derived, normalizeTags, type DataSource } from './dataSource'

const SUMMARY_COLUMNS =
  'id,title,slug,excerpt,note_type,status,visibility,is_pinned,is_favorite,category_id,reading_time,cover_image,created_at,updated_at,published_at,archived_at,note_tags(tags(name))'

const IMAGE_BUCKET = 'note-images'
const ATTACHMENT_BUCKET = 'note-attachments'

type TagRef = { name: string }
type Row = Record<string, unknown> & { note_tags?: Array<{ tags: TagRef | TagRef[] | null }> }

function toSummary<T extends NoteSummary>(row: Row): T {
  const { note_tags, ...rest } = row
  const tags = (note_tags ?? [])
    .flatMap((nt) => (Array.isArray(nt.tags) ? nt.tags : nt.tags ? [nt.tags] : []))
    .map((t) => t.name)
    .filter(Boolean)
    .sort()
  return { ...(rest as unknown as T), tags }
}

function toUser(user: User | null | undefined): AuthUser | null {
  return user ? { id: user.id, email: user.email ?? null } : null
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

type PgError = { code?: string; message: string } | null

/** True when the database has not run migration 0002 yet. */
function isMissingCoverColumn(error: PgError) {
  return Boolean(error && (error.code === '42703' || error.code === 'PGRST204') && /cover_image/.test(error.message))
}

export const COVER_MIGRATION_HINT =
  'Covers need the database update supabase/migrations/0002_cover_image.sql. Run it in the Supabase SQL editor, then reload.'

export function createSupabaseSource(supabase: SupabaseClient): DataSource {
  let currentUser: AuthUser | null = null
  // Unknown until the first query. Once a missing column is seen, the app keeps
  // working without covers instead of failing every load and save.
  let coverSupported = true

  const summaryColumns = () => (coverSupported ? SUMMARY_COLUMNS : SUMMARY_COLUMNS.replace(',cover_image', ''))

  async function withCoverFallback<R extends { error: PgError }>(run: () => PromiseLike<R>): Promise<R> {
    const result = await run()
    if (coverSupported && isMissingCoverColumn(result.error)) {
      coverSupported = false
      console.warn(COVER_MIGRATION_HINT)
      return run()
    }
    return result
  }

  /** Drops cover_image from writes when the column does not exist. */
  function writable<T extends Record<string, unknown>>(payload: T): T {
    if (coverSupported || !('cover_image' in payload)) return payload
    const { cover_image, ...rest } = payload
    if (cover_image) throw new Error(COVER_MIGRATION_HINT)
    return rest as T
  }

  async function requireUser(): Promise<AuthUser> {
    if (currentUser) return currentUser
    const { data } = await supabase.auth.getSession()
    currentUser = toUser(data.session?.user)
    if (!currentUser) throw new Error('You need to sign in first.')
    return currentUser
  }

  async function fetchNote(by: { id?: string; slug?: string }): Promise<Note | null> {
    const { data, error } = await withCoverFallback(() => {
      const query = supabase.from('notes').select(`${summaryColumns()},content_markdown`)
      return (by.id ? query.eq('id', by.id) : query.eq('slug', by.slug ?? '')).maybeSingle()
    })
    fail(error)
    return data ? toSummary<Note>(data as unknown as Row) : null
  }

  async function seedCategoriesIfEmpty(user: AuthUser) {
    const flag = `devnotes:seeded:${user.id}`
    if (localStorage.getItem(flag)) return
    const { count } = await supabase.from('categories').select('id', { count: 'exact', head: true })
    if (count === 0) {
      const { error } = await supabase.from('categories').insert(
        DEFAULT_CATEGORIES.map((c, i) => ({
          name: c.name,
          slug: slugify(c.name),
          icon: c.icon,
          description: c.description ?? null,
          sort_order: i,
        })),
      )
      if (error) return
    }
    localStorage.setItem(flag, '1')
  }

  const source: DataSource = {
    mode: 'supabase',

    supportsCovers: () => coverSupported,

    async getUser() {
      const { data } = await supabase.auth.getSession()
      currentUser = toUser(data.session?.user)
      return currentUser
    },

    onAuthChange(cb) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        currentUser = toUser(session?.user)
        cb(currentUser)
      })
      return () => data.subscription.unsubscribe()
    },

    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      fail(error)
      // The database is the real gate (migration 0003); this just gives a clear message.
      const { data: isOwner, error: rpcError } = await supabase.rpc('is_app_owner')
      if (!rpcError && isOwner === false) {
        await supabase.auth.signOut()
        currentUser = null
        throw new Error('This account is not the owner of this DevNotes site.')
      }
    },

    async signOut() {
      const { error } = await supabase.auth.signOut()
      fail(error)
      currentUser = null
    },

    async listNotes() {
      const { data: session } = await supabase.auth.getSession()
      const { data, error } = await withCoverFallback(() => {
        const query = supabase.from('notes').select(summaryColumns()).order('updated_at', { ascending: false })
        return session.session
          ? query.eq('user_id', session.session.user.id)
          : query.eq('visibility', 'PUBLIC').eq('status', 'PUBLISHED')
      })
      fail(error)
      return (data ?? []).map((row) => toSummary<NoteSummary>(row as unknown as Row))
    },

    getNote: fetchNote,

    async createNote(input, tags) {
      await requireUser()
      const { data, error } = await withCoverFallback(() =>
        supabase
          .from('notes')
          .insert(writable({ ...input, slug: input.slug ?? slugify(input.title), ...derived(input) }))
          .select('id')
          .single(),
      )
      fail(error)
      const id = (data as { id: string }).id
      if (tags.length) await source.setTags(id, tags)
      return (await fetchNote({ id }))!
    },

    async updateNote(id, patch) {
      await requireUser()
      const { error } = await withCoverFallback(() =>
        supabase
          .from('notes')
          .update(writable({ ...patch, ...derived(patch) }))
          .eq('id', id),
      )
      fail(error)
      const note = await fetchNote({ id })
      if (!note) throw new Error('Note not found')
      return note
    },

    async setTags(noteId, tags) {
      const { error } = await supabase.rpc('set_note_tags', { p_note_id: noteId, p_tags: normalizeTags(tags) })
      fail(error)
    },

    async deleteNote(id) {
      const user = await requireUser()
      // Remove stored files first so nothing is orphaned in Storage.
      const prefix = `${user.id}/${id}`
      for (const bucket of [IMAGE_BUCKET, ATTACHMENT_BUCKET]) {
        const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 })
        if (data?.length) await supabase.storage.from(bucket).remove(data.map((f) => `${prefix}/${f.name}`))
      }
      const { error } = await supabase.from('notes').delete().eq('id', id)
      fail(error)
    },

    async search(q, options = {}) {
      const { data, error } = await supabase.rpc('search_notes', {
        q,
        include_archived: options.includeArchived ?? false,
        max_results: options.limit ?? 30,
      })
      fail(error)
      return (data ?? []) as SearchHit[]
    },

    async listCategories() {
      const { data: session } = await supabase.auth.getSession()
      const user = toUser(session.session?.user)
      if (user) await seedCategoriesIfEmpty(user)
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order')
        .order('name')
      fail(error)
      return (data ?? []) as Category[]
    },

    async createCategory(input) {
      await requireUser()
      const { data: last } = await supabase
        .from('categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      const { data, error } = await supabase
        .from('categories')
        .insert({
          name: input.name.trim(),
          slug: slugify(input.name),
          description: input.description ?? null,
          icon: input.icon ?? null,
          sort_order: ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1,
        })
        .select('*')
        .single()
      if (error?.code === '23505') throw new Error(`A category named “${input.name}” already exists.`)
      fail(error)
      return data as Category
    },

    async updateCategory(id, input) {
      const patch: Record<string, unknown> = { ...input }
      if (input.name) {
        patch.name = input.name.trim()
        patch.slug = slugify(input.name)
      }
      const { data, error } = await supabase.from('categories').update(patch).eq('id', id).select('*').single()
      if (error?.code === '23505') throw new Error(`A category named “${input.name}” already exists.`)
      fail(error)
      return data as Category
    },

    async deleteCategory(id) {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      fail(error)
    },

    async uploadImage(noteId, file) {
      const user = await requireUser()
      const path = `${user.id}/${noteId}/${uid().slice(0, 8)}-${sanitizeFileName(file.name)}`
      const { error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
      fail(error)
      return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
    },

    async listAttachments(noteId) {
      const { data, error } = await supabase
        .from('note_attachments')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at')
      fail(error)
      return (data ?? []) as Attachment[]
    },

    async uploadAttachment(noteId, file, mime) {
      const user = await requireUser()
      const path = `${user.id}/${noteId}/${uid().slice(0, 8)}-${sanitizeFileName(file.name)}`
      const { error: upErr } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, file, { contentType: mime, upsert: false })
      fail(upErr)
      const { data, error } = await supabase
        .from('note_attachments')
        .insert({ note_id: noteId, file_name: file.name, storage_path: path, mime_type: mime, file_size: file.size })
        .select('*')
        .single()
      if (error) {
        await supabase.storage.from(ATTACHMENT_BUCKET).remove([path])
        fail(error)
      }
      return data as Attachment
    },

    async deleteAttachment(attachment) {
      const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.storage_path])
      fail(error)
      const { error: dbErr } = await supabase.from('note_attachments').delete().eq('id', attachment.id)
      fail(dbErr)
    },

    async attachmentUrl(attachment, download = false) {
      // Short-lived signed URL — private attachments are never exposed permanently.
      const { data, error } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(attachment.storage_path, 60 * 5, download ? { download: attachment.file_name } : undefined)
      fail(error)
      return data!.signedUrl
    },
  }
  return source
}
