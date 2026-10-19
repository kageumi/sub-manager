import { useEffect, useRef } from 'react'

export function useSaveShortcut(save, active) {
  const latest = useRef(save)
  latest.current = save
  useEffect(() => {
    if (!active) return
    const listener = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        latest.current()
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [active])
}
