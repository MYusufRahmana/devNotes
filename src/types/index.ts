export const NOTE_TYPES = ['SNIPPET', 'CHEATSHEET', 'TROUBLESHOOTING', 'GUIDE', 'ARTICLE'] as const
export type NoteType = (typeof NOTE_TYPES)[number]
export type NoteStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type Visibility = 'PRIVATE' | 'PUBLIC'

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface NoteSummary {
  id: string
  title: string
  slug: string
  excerpt: string | null
  note_type: NoteType
  status: NoteStatus
  visibility: Visibility
  is_pinned: boolean
  is_favorite: boolean
  category_id: string | null
  reading_time: number
  cover_image: string | null
  tags: string[]
  created_at: string
  updated_at: string
  published_at: string | null
  archived_at: string | null
}

export interface Note extends NoteSummary {
  content_markdown: string
}

export interface NoteInput {
  title: string
  content_markdown: string
  note_type: NoteType
  category_id: string | null
  visibility: Visibility
  status: NoteStatus
  slug?: string
  cover_image?: string | null
}

export type NotePatch = Partial<NoteInput & { is_pinned: boolean; is_favorite: boolean }>

export interface Attachment {
  id: string
  note_id: string
  file_name: string
  storage_path: string
  mime_type: string
  file_size: number
  created_at: string
}

export interface SearchHit extends NoteSummary {
  snippet: string | null
  score: number
}

export interface CategoryInput {
  name: string
  description?: string | null
  icon?: string | null
}

export interface AuthUser {
  id: string
  email: string | null
}
