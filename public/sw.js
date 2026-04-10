const CACHE_NAME = 'carecompanion-v1'
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/chat',
  '/care',
  '/scans',
  '/offline',
]

// Install: cache critical pages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first for API, stale-while-revalidate for pages
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests (mutations handled by offline-queue)
  if (request.method !== 'GET') return

  // API requests: network only (don't cache dynamic data)
  if (url.pathname.startsWith('/api/')) return

  // Pages and assets: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok && response.status === 200) {
          cache.put(request, response.clone())
        }
        return response
      }).catch(() => {
        // If offline and no cache, serve offline page
        if (!cached && request.mode === 'navigate') {
          return cache.match('/offline') || new Response('Offline', { status: 503 })
        }
        return cached
      })
      return cached || fetchPromise
    })
  )
})
