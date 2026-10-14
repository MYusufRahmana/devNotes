import type { NoteStatus, NoteType, Visibility } from '@/types'

export interface SeedCategory {
  name: string
  icon: string
  description?: string
}

export const DEFAULT_CATEGORIES: SeedCategory[] = [
  { name: 'Git', icon: 'git-branch', description: 'Branching, syncing and history.' },
  { name: 'React', icon: 'atom', description: 'Components, hooks and patterns.' },
  { name: 'Laravel', icon: 'flame', description: 'Artisan, Eloquent and deployment.' },
  { name: 'Docker', icon: 'container', description: 'Images, compose and permissions.' },
  { name: 'Database', icon: 'database', description: 'PostgreSQL, MySQL and queries.' },
  { name: 'Networking', icon: 'network', description: 'MikroTik, DNS and Cloudflare.' },
  { name: 'Linux', icon: 'terminal', description: 'Shell, services and VPS setup.' },
  { name: 'Windows', icon: 'monitor', description: 'PowerShell and Windows quirks.' },
  { name: 'Supabase', icon: 'zap', description: 'Auth, RLS and storage.' },
  { name: 'Troubleshooting', icon: 'wrench', description: 'Things that broke once.' },
]

export interface SeedNote {
  title: string
  type: NoteType
  category: string
  tags: string[]
  status: NoteStatus
  visibility: Visibility
  pinned?: boolean
  favorite?: boolean
  daysAgo: number
  content: string
}

const fence = '```'

export const SAMPLE_NOTES: SeedNote[] = [
  {
    title: 'Git Branch Compare Commands',
    type: 'CHEATSHEET',
    category: 'Git',
    tags: ['git', 'branch', 'merge', 'workflow'],
    status: 'PUBLISHED',
    visibility: 'PRIVATE',
    pinned: true,
    favorite: true,
    daysAgo: 0.08,
    content: `Quick reference for fetching, comparing and inspecting branches before a merge.

## Update remote references

${fence}bash
git fetch --all --prune
git branch -avv
${fence}

## Compare commit count

Left number = commits only in \`development\`, right number = commits only in \`main\`.

${fence}bash
git rev-list --left-right --count development...main
${fence}

## Commits in one branch but not the other

${fence}bash title="Development commits not in main"
git log main..development --oneline
${fence}

${fence}bash title="Main commits not in development"
git log development..main --oneline
${fence}

## Diff summary

| Command | Function |
| --- | --- |
| \`git diff main...development --stat\` | Files changed since branches diverged |
| \`git merge-base main development\` | Common ancestor commit |
| \`git log --graph --oneline --all\` | Visual branch history |
`,
  },
  {
    title: 'Laravel Clear Cache',
    type: 'SNIPPET',
    category: 'Laravel',
    tags: ['laravel', 'artisan', 'cache'],
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    favorite: true,
    daysAgo: 1.2,
    content: `Clears config, route, view, event and compiled caches in one go.

${fence}bash
php artisan optimize:clear
${fence}
`,
  },
  {
    title: 'Docker chown Permission Error',
    type: 'TROUBLESHOOTING',
    category: 'Docker',
    tags: ['docker', 'permissions', 'build'],
    status: 'PUBLISHED',
    visibility: 'PRIVATE',
    pinned: true,
    daysAgo: 0.15,
    content: `## Problem

Docker build fails while running:

${fence}bash
chown -R www-data:www-data /var/www/storage
${fence}

## Symptoms

- Build exits with code 1
- \`chown: cannot access '/var/www/storage': No such file or directory\`

## Environment

- Docker Desktop 4.x, BuildKit enabled
- \`php:8.3-fpm\` base image

## Cause

The directory does not exist yet in the current build stage — the application code is copied **after** the \`chown\` step, or in a different stage of a multi-stage build.

## Solution

1. Move \`COPY . /var/www\` above the \`chown\` line.
2. Or create the directory first and set ownership during copy:

${fence}dockerfile
WORKDIR /var/www
COPY --chown=www-data:www-data . .
RUN mkdir -p storage bootstrap/cache \\
 && chmod -R ug+rwx storage bootstrap/cache
${fence}

## Verification

${fence}bash
docker compose build --no-cache app
docker compose run --rm app ls -la storage
${fence}

## Notes

- \`COPY --chown\` avoids an extra layer compared with \`RUN chown -R\`.
`,
  },
  {
    title: 'PostgreSQL psql.exe Blocked by Device Guard',
    type: 'TROUBLESHOOTING',
    category: 'Database',
    tags: ['postgresql', 'windows', 'device-guard'],
    status: 'PUBLISHED',
    visibility: 'PRIVATE',
    daysAgo: 1.1,
    content: `## Problem

Running \`psql\` on Windows fails because Windows Defender Application Control blocks the binary.

## Symptoms

${fence}powershell
psql : Your organization used Device Guard to block this app.
${fence}

## Cause

Code integrity policy only allows signed binaries from approved locations.

## Solution

Use the psql binary bundled with an approved install path, or connect through Docker:

${fence}powershell
docker run -it --rm postgres:16 psql "postgresql://user:pass@host.docker.internal:5432/app"
${fence}

## Verification

${fence}sql
select version();
${fence}
`,
  },
  {
    title: 'How to Setup Supabase with React',
    type: 'GUIDE',
    category: 'Supabase',
    tags: ['supabase', 'react', 'vite', 'auth'],
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    daysAgo: 3,
    content: `## Objective

Connect a Vite + React app to Supabase with typed client and email login.

## Requirements

- Node 20+
- A Supabase project (URL + anon key)

## Steps

1. Install the client.
2. Add environment variables.
3. Create a single shared client.
4. Read the session on load.

## Commands

${fence}bash
npm install @supabase/supabase-js
${fence}

${fence}bash title=".env.local"
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
${fence}

${fence}ts title="src/lib/supabase.ts"
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
${fence}

${fence}tsx
const { data } = await supabase.auth.getSession()
console.log(data.session?.user.email)
${fence}

## Verification

Sign in, refresh the page and check that \`getSession()\` still returns the user.

## Notes

- Never ship the \`service_role\` key to the browser.
- Protect every table with RLS — route guards are not security.
`,
  },
  {
    title: 'Understanding Git Branch Synchronization',
    type: 'ARTICLE',
    category: 'Git',
    tags: ['git', 'branch', 'rebase'],
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    daysAgo: 6,
    content: `## Introduction

Keeping a long-lived \`development\` branch in sync with \`main\` is mostly about knowing **which direction** commits need to travel, and choosing between merge and rebase deliberately.

## Main Content

### Fetch first, always

Local branch pointers are only as fresh as your last fetch.

${fence}bash
git fetch origin --prune
${fence}

### Merge: preserves history

${fence}bash
git switch development
git merge origin/main
${fence}

A merge commit records that the two lines of work met. Safe for shared branches.

### Rebase: linear history

${fence}bash
git switch feature/login
git rebase origin/development
${fence}

Rewrites your commits on top of the target. Only rebase branches nobody else has pulled.

### When things diverge

Use \`rev-list\` to see how far apart two branches are before deciding:

${fence}bash
git rev-list --left-right --count origin/main...development
${fence}

## Conclusion

Merge shared branches, rebase private ones, and always fetch before comparing.

## References

- [Pro Git — Branching](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell)
`,
  },
  {
    title: 'MikroTik Simple Queue per IP',
    type: 'CHEATSHEET',
    category: 'Networking',
    tags: ['mikrotik', 'queue', 'bandwidth'],
    status: 'DRAFT',
    visibility: 'PRIVATE',
    daysAgo: 2,
    content: `## Topic

Limit bandwidth per client with Simple Queue.

${fence}bash
/queue simple add name=client-10 target=192.168.88.10/32 max-limit=5M/10M
/queue simple print stats
${fence}

## Notes

- \`max-limit\` is upload/download from the client's point of view.
`,
  },
]
