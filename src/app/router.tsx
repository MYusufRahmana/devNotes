import { createBrowserRouter, Navigate, Outlet, useLocation, useRouteError, isRouteErrorResponse } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { useAuth } from '@/features/auth/AuthProvider'
import { PUBLIC_PUBLISHING } from '@/features/notes/dataSource'
import { HomePage } from '@/pages/HomePage'
import { AllNotesPage } from '@/pages/AllNotesPage'
import { FavoritesPage, PinnedPage } from '@/pages/FavoritesPage'
import { DraftsPage } from '@/pages/DraftsPage'
import { ArchivePage } from '@/pages/ArchivePage'
import { CategoryPage } from '@/pages/CategoryPage'
import { NotePage } from '@/pages/NotePage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/** UI guard only — the real protection is Supabase RLS. */
function RequireOwner() {
  const { isOwner } = useAuth()
  const location = useLocation()
  if (!isOwner) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <Outlet />
}

/** When public publishing is off, visitors only ever see the login page. */
function PublicGate() {
  const { isOwner } = useAuth()
  const location = useLocation()
  if (!PUBLIC_PUBLISHING && !isOwner) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  return <AppShell />
}

function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unexpected error'
  const chunkError = /dynamically imported module|Failed to fetch/i.test(message)
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-lg font-semibold">{chunkError ? 'A new version is available.' : 'Something went wrong.'}</h1>
      <p className="mt-2 text-sm break-words text-fg-muted">{chunkError ? 'Reload to continue.' : message}</p>
      <button onClick={() => location.reload()} className="mt-6 h-9 rounded-md border border-line px-3.5 text-sm font-medium hover:bg-hover">
        Reload
      </button>
    </div>
  )
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  {
    element: <PublicGate />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'notes', element: <AllNotesPage /> },
      { path: 'notes/:slug', element: <NotePage /> },
      { path: 'category/:slug', element: <CategoryPage /> },
      {
        element: <RequireOwner />,
        children: [
          { path: 'favorites', element: <FavoritesPage /> },
          { path: 'pinned', element: <PinnedPage /> },
          { path: 'drafts', element: <DraftsPage /> },
          { path: 'archive', element: <ArchivePage /> },
          {
            path: 'settings',
            lazy: () => import('@/pages/SettingsPage').then((m) => ({ Component: m.SettingsPage })),
          },
          {
            // One layout route for both paths so /new → /edit/:id after the first save
            // keeps the same editor instance (no remount, no lost cursor).
            lazy: () => import('@/pages/EditorPage').then((m) => ({ Component: m.EditorPage })),
            children: [{ path: 'new' }, { path: 'edit/:id' }],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
