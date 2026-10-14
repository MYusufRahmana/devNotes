import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { LogoMark } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { PUBLIC_PUBLISHING } from '@/features/notes/dataSource'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { errorMessage } from '@/lib/utils'

function safeNext(next: string | null) {
  // eslint-disable-next-line no-control-regex
  return next && /^\/(?![/\\])/.test(next) && !/[\\\u0000-\u001f]/.test(next) ? next : '/'
}

export function LoginPage() {
  useDocumentTitle('Sign in')
  const { user, signIn, mode } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={next} replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      navigate(next, { replace: true })
    } catch (err) {
      const msg = errorMessage(err)
      setError(/invalid login/i.test(msg) ? 'Wrong email or password.' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[360px]">
        <div className="flex flex-col items-center text-center">
          <LogoMark className="size-9" />
          <h1 className="mt-4 text-xl font-semibold tracking-[-0.015em]">Sign in to DevNotes</h1>
          <p className="mt-1 text-sm text-fg-muted">Owner access to create and edit notes.</p>
        </div>

        {mode === 'local' ? (
          <div className="mt-8 rounded-xl border border-line bg-surface p-5">
            <p className="text-sm text-fg-muted">
              Running in <span className="font-medium text-fg">demo mode</span>. Notes are stored in this browser only.
              Add Supabase keys to <code className="rounded bg-subtle px-1 text-[12.5px]">.env.local</code> to enable real
              accounts.
            </p>
            <Button
              variant="primary"
              className="mt-4 w-full"
              loading={loading}
              onClick={async () => {
                setLoading(true)
                await signIn('', '')
                navigate(next, { replace: true })
              }}
            >
              Continue as owner
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 rounded-xl border border-line bg-surface p-5">
            <label htmlFor="email" className="block text-[13px] font-medium text-fg-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-line bg-bg px-3 text-sm outline-none focus:border-accent"
            />
            <label htmlFor="password" className="mt-3 block text-[13px] font-medium text-fg-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-line bg-bg px-3 text-sm outline-none focus:border-accent"
            />
            {error && (
              <p role="alert" className="mt-3 text-[13px] text-danger">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" className="mt-4 w-full" loading={loading}>
              Sign in
            </Button>
          </form>
        )}

        {PUBLIC_PUBLISHING && (
          <Link to="/" className="mt-6 flex items-center justify-center gap-1.5 text-[13px] text-fg-muted hover:text-fg">
            <ArrowLeft className="size-3.5" /> Back to public notes
          </Link>
        )}
      </div>
    </div>
  )
}
