import type { Category, Note, NoteType } from '@/types'
import { NOTE_TYPES } from '@/types'
import { firstH1, parseFrontmatter, toFrontmatter } from '@/lib/markdown'
import { downloadBlob } from '@/lib/utils'
import { source } from './source'

export function noteToMarkdown(note: Note, category?: Category | null): string {
  const fm = toFrontmatter({
    title: note.title,
    type: note.note_type.toLowerCase(),
    category: category?.name,
    tags: note.tags,
    status: note.status.toLowerCase(),
    visibility: note.visibility.toLowerCase(),
    pinned: note.is_pinned || undefined,
    favorite: note.is_favorite || undefined,
    cover: note.cover_image,
    created: note.created_at,
    updated: note.updated_at,
  })
  return `${fm}\n# ${note.title}\n\n${note.content_markdown.trim()}\n`
}

export function exportNote(note: Note, category?: Category | null) {
  downloadBlob(new Blob([noteToMarkdown(note, category)], { type: 'text/markdown;charset=utf-8' }), `${note.slug}.md`)
}

/** Zips every note as `<category>/<slug>.md`. */
export async function exportAll(categories: Category[], onProgress?: (done: number, total: number) => void) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const byId = new Map(categories.map((c) => [c.id, c]))
  const index = await source.listNotes()

  let done = 0
  for (const summary of index) {
    const note = await source.getNote({ id: summary.id })
    if (!note) continue
    const category = note.category_id ? byId.get(note.category_id) : null
    const folder = note.status === 'ARCHIVED' ? '_archived' : (category?.slug ?? 'uncategorized')
    zip.file(`${folder}/${note.slug}.md`, noteToMarkdown(note, category))
    onProgress?.(++done, index.length)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const stamp = new Date().toISOString().slice(0, 10)
  downloadBlob(blob, `devnotes-export-${stamp}.zip`)
  return done
}

const MAX_IMPORT_BYTES = 1024 * 1024

export interface ImportResult {
  imported: number
  failed: Array<{ file: string; error: string }>
}

/**
 * Imports .md files. Title comes from frontmatter, then the first `# H1`
 * (which is removed from the body), then the file name.
 */
export async function importMarkdownFiles(files: File[], categories: Category[]): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, failed: [] }
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))

  for (const file of files) {
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('File is larger than 1 MB')
      const { data, body } = parseFrontmatter(await file.text())
      let content = body
      let title = typeof data.title === 'string' ? data.title : null
      const h1 = firstH1(content)
      if (h1 && (!title || h1.toLowerCase() === title.toLowerCase())) {
        title ??= h1
        content = content.replace(/^\s*#\s+.+\n?/, '')
      }
      title ??= file.name.replace(/\.(md|markdown|txt)$/i, '').replace(/[-_]+/g, ' ')

      let categoryId: string | null = null
      if (typeof data.category === 'string' && data.category.trim()) {
        const existing = byName.get(data.category.toLowerCase())
        const category = existing ?? (await source.createCategory({ name: data.category.trim() }))
        byName.set(category.name.toLowerCase(), category)
        categoryId = category.id
      }

      const type: NoteType = NOTE_TYPES.includes(data.type as NoteType) ? (data.type as NoteType) : 'ARTICLE'
      const note = await source.createNote(
        {
          title,
          content_markdown: content.trim() + '\n',
          note_type: type,
          category_id: categoryId,
          visibility: data.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
          status: data.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
          cover_image: typeof data.cover === 'string' && /^https?:\/\//.test(data.cover) ? data.cover : null,
        },
        Array.isArray(data.tags) ? data.tags : [],
      )
      if (data.pinned || data.favorite) {
        await source.updateNote(note.id, { is_pinned: Boolean(data.pinned), is_favorite: Boolean(data.favorite) })
      }
      result.imported++
    } catch (e) {
      result.failed.push({ file: file.name, error: e instanceof Error ? e.message : 'Unknown error' })
    }
  }
  return result
}
