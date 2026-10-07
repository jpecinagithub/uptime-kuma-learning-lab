import { createContext, useContext, useEffect, useState } from 'react'
import { apiGet, getMode, setModeGlobal, subscribeOffline } from './api.js'

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const [mode, setModeState] = useState(() => getMode())
  const [learning, setLearning] = useState(() => {
    try {
      return localStorage.getItem('mlab-learning') === '1'
    } catch {
      return false
    }
  })
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('mlab-theme') || 'dark'
    } catch {
      return 'dark'
    }
  })
  const [health, setHealth] = useState(null)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('mlab-theme', theme)
    } catch {
      /* noop */
    }
  }, [theme])

  const refreshHealth = async () => {
    try {
      const { data } = await apiGet('/health', { useCache: false })
      setHealth(data)
    } catch {
      /* el banner offline ya avisa */
    }
  }

  useEffect(() => {
    refreshHealth()
    const t = setInterval(refreshHealth, 30000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => subscribeOffline(setOffline), [])

  const setMode = (m) => {
    setModeGlobal(m)
    setModeState(m)
  }

  const toggleLearning = () => {
    setLearning((v) => {
      try {
        localStorage.setItem('mlab-learning', v ? '0' : '1')
      } catch {
        /* noop */
      }
      return !v
    })
  }

  return (
    <AppCtx.Provider
      value={{
        mode, // auto | demo | real (preferencia del usuario)
        setMode,
        effectiveMode: health?.mode || (mode === 'auto' ? 'demo' : mode), // lo que sirve el backend
        learning,
        toggleLearning,
        setLearning,
        theme,
        setTheme,
        health,
        refreshHealth,
        offline,
      }}
    >
      {children}
    </AppCtx.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider')
  return ctx
}
