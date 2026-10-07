// Capa de acceso a la API propia (mismo origen, /api/*).
// - Modo global: auto | demo | real (localStorage). En auto no se envía ?mode=
//   y el backend decide; en demo/real se fuerza con ?mode=.
// - Caché: la última respuesta OK de cada GET se guarda en localStorage.
//   Si la red falla, se sirve la caché y la app muestra el banner
//   "Datos sin conexión — última actualización HH:MM". Nunca se muestran
//   datos viejos como si fueran actuales.

const MODE_KEY = 'mlab-mode'
const CACHE_PREFIX = 'mlab-cache:'

let offline = false
const listeners = new Set()

export function getMode() {
  return localStorage.getItem(MODE_KEY) || 'auto'
}

export function setModeGlobal(m) {
  localStorage.setItem(MODE_KEY, m)
}

function buildUrl(path) {
  const mode = getMode()
  if (mode === 'demo' || mode === 'real') {
    const sep = path.includes('?') ? '&' : '?'
    return `/api${path}${sep}mode=${mode}`
  }
  return `/api${path}`
}

function setOffline(v) {
  if (offline !== v) {
    offline = v
    listeners.forEach((cb) => cb(v))
  }
}

export function subscribeOffline(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function isOffline() {
  return offline
}

// Timestamp más reciente entre todas las cachés (para el banner offline).
export function latestCacheTs() {
  let latest = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(CACHE_PREFIX)) {
        const raw = JSON.parse(localStorage.getItem(k))
        if (raw && raw.ts > latest) latest = raw.ts
      }
    }
  } catch {
    /* noop */
  }
  return latest
}

function readCache(path) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + path)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function apiGet(path, { useCache = true } = {}) {
  const url = buildUrl(path)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (useCache) {
      try {
        localStorage.setItem(CACHE_PREFIX + path, JSON.stringify({ data, ts: Date.now() }))
      } catch {
        /* caché llena: no es crítico */
      }
    }
    setOffline(false)
    return { data, cached: false, ts: Date.now() }
  } catch (err) {
    const cached = useCache ? readCache(path) : null
    setOffline(true)
    if (cached) return { data: cached.data, cached: true, ts: cached.ts }
    throw err
  }
}

export async function apiPost(path, body) {
  const url = buildUrl(path)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j && j.error) detail = j.error
    } catch {
      /* noop */
    }
    throw new Error(detail)
  }
  setOffline(false)
  return res.json()
}

// Normaliza el estado de un monitor a una de las 4 categorías visuales.
export function normalizeStatus(s) {
  const v = String(s ?? '').toLowerCase()
  if (['up', 'online', 'operativo', 'ok', '1'].includes(v)) return 'up'
  if (['down', 'offline', 'caido', 'caído', '0'].includes(v)) return 'down'
  if (['degraded', 'degradado', 'warn', '2'].includes(v)) return 'degraded'
  return 'unknown'
}

// Estado numérico de los history points: 0 DOWN, 1 UP, 2 PENDING, 3 MAINTENANCE
export function pointStatusLabel(n) {
  if (n === 1) return 'up'
  if (n === 0) return 'down'
  if (n === 2) return 'degraded'
  return 'unknown'
}

export function fmtTime(ts, opts) {
  if (!ts) return '—'
  try {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      ...(opts || {}),
    }).format(new Date(ts))
  } catch {
    return '—'
  }
}

export function fmtDateTime(ts) {
  return fmtTime(ts, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function fmtDuration(ms) {
  if (ms == null || ms < 0) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function fmtBytes(b) {
  if (b == null) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = Number(b)
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`
}
