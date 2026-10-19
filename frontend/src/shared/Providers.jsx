import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Toaster, toast } from '@/components/ui/toast'
import { useMediaQuery } from './useMediaQuery.js'
import './styles.css'

const ThemeContext = createContext(null)

export function Providers({ children }) {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const [theme, updateTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('sub-manager-theme')
      return ['light', 'dark', 'system'].includes(saved) ? saved : 'system'
    } catch {
      return 'system'
    }
  })
  const dark = theme === 'dark' || (theme === 'system' && systemDark)
  const setTheme = useCallback((value) => {
    if (!['light', 'dark', 'system'].includes(value)) return
    updateTheme(value)
    try {
      localStorage.setItem('sub-manager-theme', value)
    } catch {
      /* Optional storage. */
    }
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])
  useEffect(() => {
    // Keep the mobile browser chrome in sync with the page background token.
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return
    const probe = document.createElement('div')
    probe.style.background = 'var(--page)'
    probe.style.display = 'none'
    document.body.append(probe)
    const color = getComputedStyle(probe).backgroundColor
    probe.remove()
    if (color) meta.setAttribute('content', color)
  }, [dark])
  return (
    <ThemeContext.Provider value={{ theme, dark, setTheme }}>
      <Toaster limit={3}>
        <div className="min-h-dvh">{children}</div>
      </Toaster>
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
const notify = (title, error = false) => {
  toast.add({ title, type: error ? 'error' : 'success', timeout: error ? 6000 : 3000 })
}
export const useNotify = () => notify
