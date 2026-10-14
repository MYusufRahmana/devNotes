import {
  Bold,
  Code,
  Heading,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Quote,
  SquareCode,
  Table,
  type LucideIcon,
} from 'lucide-react'
import { modKey } from '@/lib/utils'
import * as cmd from './commands'

interface Tool {
  label: string
  icon: LucideIcon
  run: (ta: HTMLTextAreaElement) => void
}

const GROUPS: Tool[][] = [
  [
    { label: 'Heading', icon: Heading, run: cmd.heading },
    { label: `Bold (${modKey}+B)`, icon: Bold, run: (ta) => cmd.wrap(ta, '**') },
    { label: `Italic (${modKey}+I)`, icon: Italic, run: (ta) => cmd.wrap(ta, '_') },
  ],
  [
    { label: `Inline code (${modKey}+E)`, icon: Code, run: (ta) => cmd.wrap(ta, '`', '`', 'code') },
    { label: 'Code block', icon: SquareCode, run: (ta) => cmd.codeBlock(ta) },
    { label: 'Link', icon: Link2, run: cmd.link },
  ],
  [
    { label: 'Quote', icon: Quote, run: (ta) => cmd.toggleLinePrefix(ta, '> ', /^>\s?/) },
    { label: 'Bullet list', icon: List, run: (ta) => cmd.toggleLinePrefix(ta, '- ', /^[-*+]\s/) },
    { label: 'Numbered list', icon: ListOrdered, run: (ta) => cmd.toggleLinePrefix(ta, (i) => `${i + 1}. `, /^\d+\.\s/) },
    { label: 'Table', icon: Table, run: cmd.table },
  ],
]

export function EditorToolbar({
  getTextarea,
  onImage,
  onAttach,
  disabled,
}: {
  getTextarea: () => HTMLTextAreaElement | null
  onImage: () => void
  onAttach: () => void
  disabled?: boolean
}) {
  const btn =
    'grid size-8 shrink-0 place-items-center rounded-md text-fg-muted transition-colors duration-150 hover:bg-hover hover:text-fg disabled:opacity-40'
  return (
    <div role="toolbar" aria-label="Formatting" className="thin-scroll flex items-center gap-0.5 overflow-x-auto">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <span className="mx-1 h-4 w-px bg-line" aria-hidden />}
          {group.map((tool) => (
            <button
              key={tool.label}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              disabled={disabled}
              // Keep the textarea selection when clicking.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const ta = getTextarea()
                if (ta) tool.run(ta)
              }}
              className={btn}
            >
              <tool.icon className="size-4" />
            </button>
          ))}
        </div>
      ))}
      <span className="mx-1 h-4 w-px bg-line" aria-hidden />
      <button type="button" title="Insert image at cursor — add a caption with ![alt](url &quot;Caption&quot;)" aria-label="Insert image" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onImage} className={btn}>
        <ImagePlus className="size-4" />
      </button>
      <button type="button" title="Attach file" aria-label="Attach file" disabled={disabled} onClick={onAttach} className={btn}>
        <Paperclip className="size-4" />
      </button>
    </div>
  )
}
