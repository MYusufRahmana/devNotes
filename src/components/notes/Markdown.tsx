import { isValidElement, memo, type ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { CodeBlock } from '@/components/editor/CodeBlock'
import { LOCAL_IMAGE_PROTOCOL } from '@/features/notes/localSource'
import { SmartImage } from './SmartImage'
import { cn } from '@/lib/utils'

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

/** Parses `title="..."` from a fenced code block's meta string. */
function metaTitle(meta: unknown): string | undefined {
  if (typeof meta !== 'string') return undefined
  const m = meta.match(/title=(?:"([^"]*)"|'([^']*)'|(\S+))/)
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined
}

type HastNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown> }

/**
 * An image alone on its own line becomes a figure (block, zoomable, optional caption):
 *   ![alt text](url "Caption shown under the image")
 */
function Figure({ src, alt, caption }: { src: string; alt?: string; caption?: string }) {
  return (
    <figure className="note-figure">
      <SmartImage src={src} alt={alt} zoomable placeholderClassName="h-64" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

function heading(Tag: 'h2' | 'h3') {
  return function Heading({ id, children }: { id?: string; children?: ReactNode }) {
    return (
      <Tag id={id}>
        {id && (
          <a href={`#${id}`} className="heading-anchor" aria-label={`Link to ${textOf(children)}`}>
            #
          </a>
        )}
        {children}
      </Tag>
    )
  }
}

const components: Components = {
  pre({ node, children }) {
    const child = Array.isArray(children) ? children[0] : children
    const props = isValidElement<{ className?: string; children?: ReactNode }>(child) ? child.props : {}
    const lang = /language-([\w+#.-]+)/.exec(props.className ?? '')?.[1]
    const codeNode = node?.children?.[0] as { data?: { meta?: unknown } } | undefined
    return <CodeBlock code={textOf(props.children)} lang={lang} title={metaTitle(codeNode?.data?.meta)} />
  },
  h2: heading('h2'),
  h3: heading('h3'),
  table({ children }) {
    return (
      <div className="table-wrap thin-scroll">
        <table>{children}</table>
      </div>
    )
  },
  a({ href, children }) {
    const external = href && /^https?:\/\//.test(href)
    return (
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    )
  },
  p({ node, children }) {
    const kids = ((node?.children ?? []) as HastNode[]).filter((k) => !(k.type === 'text' && !k.value?.trim()))
    const only = kids.length === 1 ? kids[0] : null
    if (only?.type === 'element' && only.tagName === 'img') {
      const p = only.properties ?? {}
      return <Figure src={String(p.src ?? '')} alt={p.alt as string | undefined} caption={p.title as string | undefined} />
    }
    return <p>{children}</p>
  },
  // Images inside running text stay inline.
  img: ({ node: _n, src, ...props }) => <SmartImage src={typeof src === 'string' ? src : undefined} zoomable placeholderClassName="inline-block h-6 w-24" {...props} />,
}

function urlTransform(url: string) {
  return url.startsWith(LOCAL_IMAGE_PROTOCOL) ? url : defaultUrlTransform(url)
}

function MarkdownImpl({ content, serif, className }: { content: string; serif?: boolean; className?: string }) {
  return (
    <div className={cn('prose-note', serif && 'font-serif-reader', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={components} urlTransform={urlTransform}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

/** Raw HTML is never rendered (no rehype-raw), so user content cannot inject scripts. */
export const Markdown = memo(MarkdownImpl)
