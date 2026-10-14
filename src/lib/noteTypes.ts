import { BookOpen, ListChecks, Bug, Terminal, Scissors, type LucideIcon } from 'lucide-react'
import type { NoteType } from '@/types'

export interface NoteTypeMeta {
  label: string
  short: string
  description: string
  icon: LucideIcon
}

export const NOTE_TYPE_META: Record<NoteType, NoteTypeMeta> = {
  SNIPPET: {
    label: 'Snippet',
    short: 'Snippet',
    description: 'A few lines — one command, one answer.',
    icon: Scissors,
  },
  CHEATSHEET: {
    label: 'Cheatsheet',
    short: 'Cheatsheet',
    description: 'Commands you reuse, grouped by topic.',
    icon: Terminal,
  },
  TROUBLESHOOTING: {
    label: 'Troubleshooting',
    short: 'Fix',
    description: 'Problem, cause, solution, verification.',
    icon: Bug,
  },
  GUIDE: {
    label: 'Guide',
    short: 'Guide',
    description: 'Step-by-step instructions to reach a goal.',
    icon: ListChecks,
  },
  ARTICLE: {
    label: 'Article',
    short: 'Article',
    description: 'Longer technical writing.',
    icon: BookOpen,
  },
}

export function typeLabel(type: NoteType): string {
  return NOTE_TYPE_META[type]?.label ?? type
}
