import type { HighlighterCore } from 'shiki/core'

/** Language aliases → canonical Shiki language id. */
const ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  terminal: 'bash',
  ps: 'powershell',
  ps1: 'powershell',
  pwsh: 'powershell',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  yml: 'yaml',
  docker: 'dockerfile',
  golang: 'go',
  py: 'python',
  md: 'markdown',
  htm: 'html',
  conf: 'nginx',
  env: 'ini',
  psql: 'sql',
  postgres: 'sql',
  postgresql: 'sql',
  mysql: 'sql',
  patch: 'diff',
}

const LABELS: Record<string, string> = {
  bash: 'Bash',
  powershell: 'PowerShell',
  php: 'PHP',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  jsx: 'JSX',
  go: 'Go',
  sql: 'SQL',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
  dockerfile: 'Dockerfile',
  yaml: 'YAML',
  python: 'Python',
  diff: 'Diff',
  markdown: 'Markdown',
  nginx: 'Nginx',
  ini: 'INI',
  toml: 'TOML',
  xml: 'XML',
  text: 'Text',
}

const LOADERS: Record<string, () => Promise<unknown>> = {
  bash: () => import('shiki/langs/bash.mjs'),
  powershell: () => import('shiki/langs/powershell.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  nginx: () => import('shiki/langs/nginx.mjs'),
  ini: () => import('shiki/langs/ini.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
}

export function normalizeLang(lang: string | undefined): string {
  const l = (lang ?? '').toLowerCase().trim()
  if (!l) return 'text'
  return ALIASES[l] ?? l
}

export function langLabel(lang: string): string {
  return LABELS[lang] ?? (lang ? lang.charAt(0).toUpperCase() + lang.slice(1) : 'Text')
}

export function isSupported(lang: string) {
  return lang in LOADERS
}

let highlighter: Promise<HighlighterCore> | null = null
const loaded = new Set<string>()

async function getHighlighter() {
  highlighter ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, light, dark] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark-dimmed.mjs'),
    ])
    return createHighlighterCore({
      themes: [light.default, dark.default],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    })
  })()
  return highlighter
}

const cache = new Map<string, string>()

/** Returns HTML for a code block, or null when the language is unknown. */
export async function highlight(code: string, lang: string): Promise<string | null> {
  if (!isSupported(lang)) return null
  const cacheKey = `${lang}\u0000${code}`
  const hit = cache.get(cacheKey)
  if (hit) return hit

  const hl = await getHighlighter()
  if (!loaded.has(lang)) {
    const mod = (await LOADERS[lang]()) as { default: Parameters<HighlighterCore['loadLanguage']>[0] }
    await hl.loadLanguage(mod.default)
    loaded.add(lang)
  }
  const html = hl.codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark-dimmed' },
    defaultColor: false,
  })
  if (cache.size > 300) cache.clear()
  cache.set(cacheKey, html)
  return html
}
