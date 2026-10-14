import type { Category, Note, SearchHit } from '@/types'

export function tokenize(q: string): string[] {
  return Array.from(new Set(q.trim().toLowerCase().split(/\s+/).filter(Boolean))).slice(0, 8)
}

/**
 * Client-side mirror of the `search_notes` SQL function.
 * Ranking: title → tag → category → content. Every term must match somewhere.
 */
export function rankNotes(
  notes: Note[],
  categories: Category[],
  q: string,
  { includeArchived = false, limit = 30 } = {},
): SearchHit[] {
  const terms = tokenize(q)
  if (!terms.length) return []
  const phrase = q.trim().toLowerCase()
  const catName = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]))
  const now = Date.now()
  const hits: SearchHit[] = []

  for (const note of notes) {
    if (!includeArchived && note.status === 'ARCHIVED') continue
    const title = note.title.toLowerCase()
    const content = note.content_markdown.toLowerCase()
    const excerpt = (note.excerpt ?? '').toLowerCase()
    const category = note.category_id ? (catName.get(note.category_id) ?? '') : ''
    const tags = note.tags.map((t) => t.toLowerCase())

    let score = 0
    let firstPos = -1
    let allMatched = true

    for (const term of terms) {
      const inTitle = title.includes(term)
      const tagExact = tags.includes(term)
      const tagPartial = tags.some((t) => t.includes(term))
      const inCategory = category.includes(term)
      const inExcerpt = excerpt.includes(term)
      const pos = content.indexOf(term)

      if (!inTitle && !tagPartial && !inCategory && !inExcerpt && pos < 0) {
        allMatched = false
        break
      }

      if (title === term) score += 120
      else if (title.startsWith(term)) score += 100
      else if (title.includes(' ' + term)) score += 90
      else if (inTitle) score += 75

      if (tagExact) score += 60
      else if (tagPartial) score += 40

      if (category === term) score += 40
      else if (inCategory) score += 25

      if (inExcerpt) score += 15
      if (pos >= 0) {
        score += 10
        if (firstPos < 0 || pos < firstPos) firstPos = pos
      }
    }
    if (!allMatched) continue

    if (terms.length > 1 && title.includes(phrase)) score += 50
    if (note.is_pinned) score += 6
    if (note.is_favorite) score += 4
    score += Math.max(0, 5 - (now - new Date(note.updated_at).getTime()) / 86400000 / 30)
    if (note.status === 'ARCHIVED') score -= 30

    let snippet: string | null = null
    if (firstPos >= 0) {
      const raw = note.content_markdown.slice(Math.max(0, firstPos - 60), firstPos + 120)
      snippet = (firstPos > 60 ? '…' + raw.replace(/^\S*\s+/, '') : raw).replace(/\s+/g, ' ')
    }

    const { content_markdown: _omit, ...summary } = note
    void _omit
    hits.push({ ...summary, snippet, score })
  }

  return hits
    .sort((a, b) => b.score - a.score || b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit)
}

/** Makes a raw content snippet readable: drops fences, heading marks and emphasis. */
export function cleanSnippet(snippet: string | null | undefined): string | null {
  if (!snippet) return null
  const text = snippet
    .replace(/`{3,}[\w-]*/g, ' ')
    .replace(/(^|\s)#{1,6}\s/g, '$1')
    .replace(/\*\*|__|~~/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text || null
}

/** Splits text into parts flagged as matching one of the terms (for <mark>). */
export function highlightParts(text: string, q: string): Array<{ text: string; match: boolean }> {
  const terms = tokenize(q).sort((a, b) => b.length - a.length)
  if (!terms.length || !text) return [{ text, match: false }]
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  return text
    .split(re)
    .filter(Boolean)
    .map((part) => ({ text: part, match: terms.includes(part.toLowerCase()) }))
}
