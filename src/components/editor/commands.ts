/**
 * Plain-textarea Markdown commands. Edits go through `insertText` so the
 * browser's native undo/redo stack keeps working.
 */

export function replaceRange(
  ta: HTMLTextAreaElement,
  start: number,
  end: number,
  text: string,
  selStart = start + text.length,
  selEnd = selStart,
) {
  ta.focus()
  ta.setSelectionRange(start, end)
  const ok = document.execCommand?.('insertText', false, text)
  if (!ok) {
    ta.setRangeText(text, start, end, 'end')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  }
  ta.setSelectionRange(selStart, selEnd)
}

function lineBounds(value: string, start: number, end: number) {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  let lineEnd = value.indexOf('\n', end)
  if (lineEnd === -1) lineEnd = value.length
  return { lineStart, lineEnd }
}

export function wrap(ta: HTMLTextAreaElement, before: string, after = before, placeholder = 'text') {
  const { selectionStart: s, selectionEnd: e, value } = ta
  const selected = value.slice(s, e)

  // Toggle off when the selection is already wrapped.
  if (value.slice(s - before.length, s) === before && value.slice(e, e + after.length) === after) {
    replaceRange(ta, s - before.length, e + after.length, selected, s - before.length, e - before.length)
    return
  }
  const inner = selected || placeholder
  replaceRange(ta, s, e, before + inner + after, s + before.length, s + before.length + inner.length)
}

/** Adds or removes a prefix on every selected line ("## ", "> ", "- ", "1. "). */
export function toggleLinePrefix(ta: HTMLTextAreaElement, prefix: string | ((i: number) => string), pattern: RegExp) {
  const { selectionStart: s, selectionEnd: e, value } = ta
  const { lineStart, lineEnd } = lineBounds(value, s, e)
  const lines = value.slice(lineStart, lineEnd).split('\n')
  const allHave = lines.every((l) => pattern.test(l) || !l.trim())
  const next = lines
    .map((l, i) => {
      if (!l.trim() && lines.length > 1) return l
      if (allHave) return l.replace(pattern, '')
      const stripped = l.replace(/^(#{1,6}\s|>\s?|[-*+]\s(\[[ xX]\]\s)?|\d+\.\s)/, '')
      return (typeof prefix === 'function' ? prefix(i) : prefix) + stripped
    })
    .join('\n')
  replaceRange(ta, lineStart, lineEnd, next, lineStart, lineStart + next.length)
}

export function heading(ta: HTMLTextAreaElement) {
  const { selectionStart: s, value } = ta
  const { lineStart, lineEnd } = lineBounds(value, s, s)
  const line = value.slice(lineStart, lineEnd)
  const level = /^(#{1,6})\s/.exec(line)?.[1].length ?? 0
  // Cycle: none → ## → ### → none
  const nextLevel = level === 0 ? 2 : level === 2 ? 3 : 0
  const text = line.replace(/^#{1,6}\s/, '')
  const next = nextLevel ? `${'#'.repeat(nextLevel)} ${text}` : text
  replaceRange(ta, lineStart, lineEnd, next, lineStart + next.length)
}

/** Inserts a block on its own lines, padded with blank lines. */
export function insertBlock(ta: HTMLTextAreaElement, block: string, cursorOffset?: number) {
  const { selectionStart: s, selectionEnd: e, value } = ta
  const before = value.slice(0, s)
  const after = value.slice(e)
  const lead = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const trail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  const text = lead + block + trail
  const caret = s + lead.length + (cursorOffset ?? block.length)
  replaceRange(ta, s, e, text, caret)
}

export function codeBlock(ta: HTMLTextAreaElement, lang = 'bash') {
  const { selectionStart: s, selectionEnd: e, value } = ta
  const selected = value.slice(s, e)
  const opener = '```' + lang + '\n'
  if (selected) insertBlock(ta, `${opener}${selected.replace(/\n$/, '')}\n\`\`\``, opener.length + selected.length)
  else insertBlock(ta, `${opener}\n\`\`\``, opener.length)
}

export function link(ta: HTMLTextAreaElement) {
  const { selectionStart: s, selectionEnd: e, value } = ta
  const selected = value.slice(s, e)
  if (/^https?:\/\/\S+$/.test(selected)) {
    replaceRange(ta, s, e, `[](${selected})`, s + 1)
    return
  }
  const label = selected || 'link text'
  const text = `[${label}](https://)`
  const urlStart = s + label.length + 3
  replaceRange(ta, s, e, text, urlStart, urlStart + 8)
}

export function table(ta: HTMLTextAreaElement) {
  const block = '| Command | Function |\n| --- | --- |\n| `cmd` | What it does |'
  insertBlock(ta, block, 2)
  const s = ta.selectionStart
  ta.setSelectionRange(s, s + 7)
}

export function insertAtCursor(ta: HTMLTextAreaElement, text: string) {
  const { selectionStart: s, selectionEnd: e } = ta
  replaceRange(ta, s, e, text)
}

// ── Smart keys ───────────────────────────────────────────────
const LIST_RE = /^(\s*)([-*+]\s(?:\[[ xX]\]\s)?|(\d+)\.\s)(.*)$/

/** Continues lists on Enter. Returns true when it handled the key. */
export function handleEnter(ta: HTMLTextAreaElement): boolean {
  const { selectionStart: s, selectionEnd: e, value } = ta
  if (s !== e) return false
  const { lineStart } = lineBounds(value, s, s)
  const line = value.slice(lineStart, s)
  if (isInsideFence(value, s)) return false
  const m = LIST_RE.exec(line)
  if (!m) return false
  const [, indent, marker, num, rest] = m

  if (!rest.trim()) {
    // Empty item → end the list.
    replaceRange(ta, lineStart, s, '')
    return true
  }
  const nextMarker = num ? `${Number(num) + 1}. ` : marker.replace(/\[[xX]\]/, '[ ]')
  insertAtCursor(ta, `\n${indent}${nextMarker}`)
  return true
}

export function handleTab(ta: HTMLTextAreaElement, outdent: boolean) {
  const { selectionStart: s, selectionEnd: e, value } = ta
  if (s === e && !outdent) {
    const { lineStart } = lineBounds(value, s, s)
    // Right after a list marker → indent the whole item, otherwise insert two spaces.
    if (/^\s*([-*+]\s(\[[ xX]\]\s)?|\d+\.\s)$/.test(value.slice(lineStart, s))) {
      replaceRange(ta, lineStart, lineStart, '  ', s + 2)
      return
    }
    insertAtCursor(ta, '  ')
    return
  }
  const { lineStart, lineEnd } = lineBounds(value, s, e)
  const lines = value.slice(lineStart, lineEnd).split('\n')
  const next = lines.map((l) => (outdent ? l.replace(/^ {1,2}|^\t/, '') : '  ' + l)).join('\n')
  const delta = next.length - (lineEnd - lineStart)
  const firstDelta = outdent ? -(lines[0].length - lines[0].replace(/^ {1,2}|^\t/, '').length) : 2
  replaceRange(ta, lineStart, lineEnd, next, Math.max(lineStart, s + firstDelta), e + delta)
}

export function isInsideFence(value: string, pos: number): boolean {
  const before = value.slice(0, pos)
  return ((before.match(/^(```|~~~)/gm) ?? []).length & 1) === 1
}
