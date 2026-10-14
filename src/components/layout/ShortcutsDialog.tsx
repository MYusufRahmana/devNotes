import { Dialog } from '@/components/ui/Dialog'
import { Kbd } from '@/components/ui/misc'
import { modKey } from '@/lib/utils'

const GROUPS: Array<{ title: string; items: Array<[string[], string]> }> = [
  {
    title: 'Anywhere',
    items: [
      [[modKey, 'K'], 'Search notes & commands'],
      [['/'], 'Search notes'],
      [['N'], 'New note'],
      [[modKey, '\\'], 'Collapse / expand sidebar'],
      [['?'], 'Show this help'],
    ],
  },
  {
    title: 'Reading a note',
    items: [
      [['E'], 'Edit note'],
      [['F'], 'Toggle favorite'],
      [['P'], 'Toggle pin'],
    ],
  },
  {
    title: 'Editor',
    items: [
      [[modKey, 'S'], 'Save now'],
      [[modKey, 'Enter'], 'Publish'],
      [[modKey, 'B'], 'Bold'],
      [[modKey, 'I'], 'Italic'],
      [[modKey, 'E'], 'Inline code'],
      [[modKey, 'Shift', 'P'], 'Toggle preview'],
      [['Tab'], 'Indent (in lists and code)'],
      [['Esc'], 'Back to note'],
    ],
  },
]

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="shortcuts-title" className="max-w-lg">
      <div className="p-5">
        <h2 id="shortcuts-title" className="text-[15px] font-semibold">
          Keyboard shortcuts
        </h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title} className={g.title === 'Editor' ? 'sm:col-span-2' : ''}>
              <h3 className="mb-1.5 text-[11px] font-medium tracking-[0.04em] text-fg-faint uppercase">{g.title}</h3>
              <ul className={g.title === 'Editor' ? 'grid gap-x-6 sm:grid-cols-2' : ''}>
                {g.items.map(([keys, label]) => (
                  <li key={label} className="flex items-center justify-between gap-3 py-1 text-sm">
                    <span className="text-fg-muted">{label}</span>
                    <span className="flex gap-0.5">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
