import type {
  Attachment,
  AuthUser,
  Category,
  CategoryInput,
  Note,
  NoteInput,
  NotePatch,
  NoteSummary,
  SearchHit,
} from '@/types'
import { makeExcerpt, readingTime } from '@/lib/markdown'

export interface SearchOptions {
  includeArchived?: boolean
  limit?: number
}

export interface DataSource {
  mode: 'supabase' | 'local'
  /** False when the database is missing the cover_image column (migration 0002). */
  supportsCovers?: () => boolean

  getUser(): Promise<AuthUser | null>
  onAuthChange(cb: (user: AuthUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>

  /** Lightweight index of every note visible to the current viewer (no content). */
  listNotes(): Promise<NoteSummary[]>
  getNote(by: { id?: string; slug?: string }): Promise<Note | null>
  createNote(input: NoteInput, tags: string[]): Promise<Note>
  updateNote(id: string, patch: NotePatch): Promise<Note>
  setTags(noteId: string, tags: string[]): Promise<void>
  deleteNote(id: string): Promise<void>
  search(q: string, options?: SearchOptions): Promise<SearchHit[]>

  listCategories(): Promise<Category[]>
  createCategory(input: CategoryInput): Promise<Category>
  updateCategory(id: string, input: Partial<CategoryInput & { sort_order: number }>): Promise<Category>
  deleteCategory(id: string): Promise<void>

  uploadImage(noteId: string, file: File): Promise<string>
  listAttachments(noteId: string): Promise<Attachment[]>
  uploadAttachment(noteId: string, file: File, mime: string): Promise<Attachment>
  deleteAttachment(attachment: Attachment): Promise<void>
  attachmentUrl(attachment: Attachment, download?: boolean): Promise<string>
}

/** Fields that are always derived from content, never typed by the user. */
export function derived(patch: NotePatch): Partial<Pick<Note, 'excerpt' | 'reading_time'>> {
  if (patch.content_markdown === undefined) return {}
  return {
    excerpt: makeExcerpt(patch.content_markdown) || null,
    reading_time: readingTime(patch.content_markdown),
  }
}

export function normalizeTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((t) => t.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-'))
        .filter((t) => t.length > 0 && t.length <= 40),
    ),
  )
}

export const PUBLIC_PUBLISHING = import.meta.env.VITE_PUBLIC_PUBLISHING !== 'false'
