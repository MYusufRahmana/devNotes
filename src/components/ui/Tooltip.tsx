import { cloneElement, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'

type TriggerProps = {
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
  onFocus?: (e: React.FocusEvent) => void
  onBlur?: (e: React.FocusEvent) => void
}

/**
 * Side tooltip rendered in a portal so it is never clipped by a scrolling sidebar.
 * Disabled tooltips render the child untouched.
 */
export function Tooltip({
  label,
  enabled = true,
  children,
}: {
  label: string
  enabled?: boolean
  children: ReactElement<TriggerProps>
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  if (!enabled) return children

  const show = (el: Element) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect()
      setPos({ top: r.top + r.height / 2, left: r.right + 8 })
    }, 250)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setPos(null)
  }

  return (
    <>
      {cloneElement(children, {
        onMouseEnter: (e: React.MouseEvent) => {
          children.props.onMouseEnter?.(e)
          show(e.currentTarget)
        },
        onMouseLeave: (e: React.MouseEvent) => {
          children.props.onMouseLeave?.(e)
          hide()
        },
        onFocus: (e: React.FocusEvent) => {
          children.props.onFocus?.(e)
          show(e.currentTarget)
        },
        onBlur: (e: React.FocusEvent) => {
          children.props.onBlur?.(e)
          hide()
        },
      })}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className="pointer-events-none fixed z-[70] -translate-y-1/2 rounded-md bg-tooltip px-2 py-1 text-xs font-medium whitespace-nowrap text-tooltip-fg shadow-pop"
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  )
}
