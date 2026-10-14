import type { NoteType } from '@/types'

export type TemplateKey = 'BLANK' | NoteType

export const TEMPLATES: Record<NoteType, string> = {
  SNIPPET: `Short description of what this does.

\`\`\`bash

\`\`\`
`,
  CHEATSHEET: `## Topic

| Command | Function |
| --- | --- |
| \`command\` | What it does |

## Examples

\`\`\`bash
# example
\`\`\`

## Notes

- 
`,
  TROUBLESHOOTING: `## Problem

What went wrong, in one sentence.

## Symptoms

- Error message / behaviour

## Environment

- OS:
- Version:

## Cause

Why it happened.

## Solution

1. 

## Commands

\`\`\`bash

\`\`\`

## Verification

\`\`\`bash

\`\`\`

## Notes

- 
`,
  GUIDE: `## Objective

What this guide achieves.

## Requirements

- 

## Steps

1. 

## Commands

\`\`\`bash

\`\`\`

## Verification

How to confirm it worked.

## Notes

- 
`,
  ARTICLE: `## Introduction

## Main Content

## Conclusion

## References

- 
`,
}

export function templateFor(key: TemplateKey): { type: NoteType; content: string } {
  if (key === 'BLANK') return { type: 'SNIPPET', content: '' }
  return { type: key, content: TEMPLATES[key] }
}

/** True when the content is still exactly a template (so switching type may swap it). */
export function isUntouchedTemplate(content: string): boolean {
  const c = content.trim()
  return c === '' || Object.values(TEMPLATES).some((t) => t.trim() === c)
}
