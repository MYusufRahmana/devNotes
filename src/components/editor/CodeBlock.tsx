import { memo, useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { highlight, langLabel, normalizeLang } from '@/lib/highlighter'
import { cn } from '@/lib/utils'

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/** Strips shell prompts ("$ ", "> ", "PS C:\>") when every command line has one. */
function copyableCode(code: string, lang: string): string {
  if (lang !== 'bash' && lang !== 'powershell') return code
  const lines = code.split('\n')
  const prompt = /^(\$|#|>|PS [^>]*>)\s/
  const commandLines = lines.filter((l) => l.trim())
  if (commandLines.length && commandLines.every((l) => prompt.test(l))) {
    return lines.map((l) => l.replace(prompt, '')).join('\n')
  }
  return code
}

export function useCopy(timeout = 1500) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), timeout)
    return () => clearTimeout(t)
  }, [copied, timeout])
  return { copied, copy: async (text: string) => setCopied(await copyText(text)) }
}

function CodeBlockImpl({ code, lang: rawLang, title }: { code: string; lang?: string; title?: string }) {
  const lang = normalizeLang(rawLang)
  const [html, setHtml] = useState<string | null>(null)
  const { copied, copy } = useCopy()
  const text = code.replace(/\n$/, '')

  useEffect(() => {
    let active = true
    highlight(text, lang)
      .then((h) => active && setHtml(h))
      .catch(() => active && setHtml(null))
    return () => {
      active = false
    }
  }, [text, lang])

  return (
    <div className="code-block group/code not-prose">
      <div className="flex h-9 items-center justify-between border-b border-line-soft pr-1.5 pl-3.5">
        <span className="truncate text-xs font-medium text-fg-muted">{title || langLabel(lang)}</span>
        <button
          type="button"
          onClick={() => copy(copyableCode(text, lang))}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
            copied ? 'text-success' : 'text-fg-muted hover:bg-hover hover:text-fg',
          )}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {html ? (
        <div className="thin-scroll" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="thin-scroll">
          <code>{text}</code>
        </pre>
      )}
    </div>
  )
}

export const CodeBlock = memo(CodeBlockImpl)
