import { Link } from 'react-router'
import { AppHeader } from '@/components/layout/AppHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function NotFoundPage({ what = 'page' }: { what?: 'page' | 'note' | 'category' }) {
  const { isOwner } = useAuth()
  useDocumentTitle('Not found')
  return (
    <>
      <AppHeader crumbs={[{ label: 'Not found' }]} />
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-sm font-medium text-fg-faint">404</p>
        <h1 className="mt-2 text-xl font-semibold">This {what} doesn’t exist.</h1>
        <p className="mt-2 text-sm text-fg-muted">
          {what === 'note' && !isOwner
            ? 'It may be private or unpublished. Sign in if it’s yours.'
            : 'It may have been renamed, archived or deleted.'}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className="inline-flex h-9 items-center rounded-md border border-line px-3.5 text-sm font-medium hover:bg-hover">
            Go home
          </Link>
          {what === 'note' && !isOwner && (
            <Link to="/login" className="inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-sm font-medium text-accent-fg hover:bg-accent-hover">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
