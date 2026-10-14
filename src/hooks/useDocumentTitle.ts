import { useEffect } from 'react'

export function useDocumentTitle(title: string | undefined | null) {
  useEffect(() => {
    document.title = title ? `${title} · DevNotes` : 'DevNotes'
  }, [title])
}
