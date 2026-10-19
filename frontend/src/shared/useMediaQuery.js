import { useEffect, useState } from 'react'

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false)

  useEffect(() => {
    const media = window.matchMedia(query)
    const handleChange = (event) => setMatches(event.matches)
    media.addEventListener('change', handleChange)
    setMatches(media.matches)
    return () => media.removeEventListener('change', handleChange)
  }, [query])

  return matches
}
