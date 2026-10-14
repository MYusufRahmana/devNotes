import type { NoteType, NoteStatus, Visibility } from '@/types'

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'untitled'
}

/** Removes markdown syntax so text can be shown as a plain excerpt. */
export function stripInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Picks the first prose paragraph. Notes that are mostly code (snippets)
 * fall back to the first code line, which is usually the useful bit.
 */
export function makeExcerpt(markdown: string, max = 180): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let inFence = false
  let firstCode = ''
  const paragraph: string[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence
      if (paragraph.length) break
      continue
    }
    if (inFence) {
      if (!firstCode && line) firstCode = line
      continue
    }
    if (!line) {
      if (paragraph.length) break
      continue
    }
    if (/^(#{1,6}\s|>\s?$|[-*_]{3,}$|\|)/.test(line)) {
      if (paragraph.length) break
      continue
    }
    paragraph.push(line.replace(/^>\s?/, '').replace(/^([-*+]|\d+\.)\s+/, ''))
  }

  const text = stripInline(paragraph.join(' ')) || firstCode
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text
}

export function readingTime(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

/** First `# Heading` of a document, if any. */
export function firstH1(markdown: string): string | null {
  const match = markdown.match(/^\s*#\s+(.+?)\s*#*\s*$/m)
  return match ? stripInline(match[1]) : null
}

/** Drops a leading `# Title` line when it duplicates the note title. */
export function stripDuplicateTitle(markdown: string, title: string): string {
  const match = markdown.match(/^\s*#\s+(.+?)\s*\n/)
  if (match && stripInline(match[1]).toLowerCase() === title.trim().toLowerCase()) {
    return markdown.slice(match[0].length)
  }
  return markdown
}

export function countHeadings(markdown: string): number {
  let inFence = false
  let count = 0
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    else if (!inFence && /^#{2,3}\s+\S/.test(line)) count++
  }
  return count
}

// ─────────────────────────────────────────────────────────────
// Frontmatter (tiny YAML subset: scalars and [a, b] / "- a" lists)
// ─────────────────────────────────────────────────────────────
export interface Frontmatter {
  title?: string
  type?: NoteType
  category?: string
  tags?: string[]
  visibility?: Visibility
  status?: NoteStatus
  pinned?: boolean
  favorite?: boolean
  cover?: string
  [key: string]: unknown
}

function parseScalar(value: string): string | boolean {
  const v = value.trim().replace(/^["']|["']$/g, '')
  if (v === 'true') return true
  if (v === 'false') return false
  return v
}

export function parseFrontmatter(source: string): { data: Frontmatter; body: string } {
  const text = source.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return { data: {}, body: text }

  const data: Record<string, unknown> = {}
  let listKey: string | null = null
  for (const line of match[1].split('\n')) {
    const item = line.match(/^\s*-\s+(.*)$/)
    if (item && listKey) {
      ;(data[listKey] as string[]).push(String(parseScalar(item[1])))
      continue
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!kv) continue
    const [, key, value] = kv
    if (value === '') {
      listKey = key
      data[key] = []
    } else if (/^\[.*\]$/.test(value.trim())) {
      listKey = null
      data[key] = value
        .trim()
        .slice(1, -1)
        .split(',')
        .map((s) => String(parseScalar(s)))
        .filter(Boolean)
    } else {
      listKey = null
      data[key] = parseScalar(value)
    }
  }

  const fm = data as Frontmatter
  if (typeof fm.type === 'string') fm.type = fm.type.toUpperCase() as NoteType
  if (typeof fm.visibility === 'string') fm.visibility = fm.visibility.toUpperCase() as Visibility
  if (typeof fm.status === 'string') fm.status = fm.status.toUpperCase() as NoteStatus
  if (typeof fm.tags === 'string') fm.tags = [fm.tags]
  return { data: fm, body: text.slice(match[0].length) }
}

function yamlValue(value: string): string {
  return /[:#\[\]{},"']|^\s|\s$/.test(value) ? JSON.stringify(value) : value
}

export function toFrontmatter(data: Record<string, string | string[] | boolean | null | undefined>): string {
  const lines = ['---']
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length) lines.push(`${key}: [${value.map(yamlValue).join(', ')}]`)
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`)
    } else {
      lines.push(`${key}: ${yamlValue(value)}`)
    }
  }
  lines.push('---', '')
  return lines.join('\n')
}
