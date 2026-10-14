import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, AlertCircle, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface ToastAction {
  label: string
  onClick: () => void
}
interface ToastItem {
  id: number
  message: string
  kind: ToastKind
  action?: ToastAction
}

interface ToastApi {
  show: (message: string, opts?: { kind?: ToastKind; action?: ToastAction; duration?: number }) => void
  success: (message: string, action?: ToastAction) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const next = useRef(1)

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const api = useMemo<ToastApi>(() => {
    const show: ToastApi['show'] = (message, opts = {}) => {
      const id = next.current++
      setItems((xs) => [...xs.slice(-3), { id, message, kind: opts.kind ?? 'info', action: opts.action }])
      setTimeout(() => dismiss(id), opts.duration ?? (opts.action || opts.kind === 'error' ? 6000 : 3000))
    }
    return {
      show,
      success: (m, action) => show(m, { kind: 'success', action }),
      error: (m) => show(m, { kind: 'error' }),
    }
  }, [dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end"
        >
          {items.map((t) => (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="toast-in pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-lg border border-line bg-elevated py-2 pr-2 pl-3 text-sm text-fg shadow-pop"
            >
              {t.kind === 'success' && <Check className="size-4 shrink-0 text-success" />}
              {t.kind === 'error' && <AlertCircle className="size-4 shrink-0 text-danger" />}
              <span className="min-w-0 flex-1">{t.message}</span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick()
                    dismiss(t.id)
                  }}
                  className="rounded px-2 py-1 text-[13px] font-medium text-accent hover:bg-hover"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="rounded p-1 text-fg-faint hover:bg-hover hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
