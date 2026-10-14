import { useEffect, useRef } from 'react'
import { isTypingTarget } from '@/lib/utils'

interface Options {
  /** Fire even while focus is in an input / textarea. */
  allowInInputs?: boolean
  enabled?: boolean
}

/**
 * `combo` examples: "mod+k", "mod+s", "/", "?", "e", "shift+n".
 * `mod` is Cmd on macOS and Ctrl elsewhere.
 */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, options: Options = {}) {
  const ref = useRef(handler)
  ref.current = handler
  const { allowInInputs = false, enabled = true } = options

  useEffect(() => {
    if (!enabled) return
    const parts = combo.toLowerCase().split('+')
    const key = parts.pop()!
    const needMod = parts.includes('mod')
    const needShift = parts.includes('shift')
    const needAlt = parts.includes('alt')

    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (needMod !== mod) return
      if (needAlt !== e.altKey) return
      // "?" is produced with shift on most layouts, so only enforce shift when asked.
      if (needShift && !e.shiftKey) return
      if (!needShift && e.shiftKey && key.length === 1 && /[a-z]/.test(key)) return
      if (e.key.toLowerCase() !== key) return
      if (!allowInInputs && !needMod && isTypingTarget(e.target)) return
      ref.current(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [combo, allowInInputs, enabled])
}
