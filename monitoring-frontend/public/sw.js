/* Monitoring Lab — Service Worker hand-rolled (sin plugins).
 *
 * Estrategia:
 * - App shell (/, /index.html, manifest, iconos): cache-first, se actualiza en segundo plano.
 * - /api/* : network-first. Si la red falla, se sirve la última respuesta cacheada
 *   (el frontend muestra el banner "Datos sin conexión — última actualización HH:MM").
 * - Todo lo demás (assets con hash): stale-while-revalidate.
 */

const SHELL_CACHE = 'mlab-shell-v1'
const API_CACHE = 'mlab-api-v1'
const ASSET_CACHE = 'mlab-assets-v1'

const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-180.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, API_CACHE, ASSET_CACHE].includes(k))
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  )
})

async function networkFirst(request) {
  const cache = await caches.open(API_CACHE)
  try {
    const res = await fetch(request)
    if (res.ok) cache.put(request, res.clone())
    return res
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw err
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => cached)
  return cached || fetchPromise
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request))
    return
  }
  if (SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    )
    return
  }
  event.respondWith(staleWhileRevalidate(request))
})
