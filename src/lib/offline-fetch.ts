import { queueMutation } from './offline-queue'

interface OfflineFetchOptions extends RequestInit {
  offlineDescription?: string
}

export async function offlineFetch(url: string, options: OfflineFetchOptions = {}): Promise<Response> {
  const { offlineDescription, ...fetchOptions } = options

  if (navigator.onLine) {
    return fetch(url, fetchOptions)
  }

  const method = (fetchOptions.method || 'GET').toUpperCase()
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    queueMutation({
      url,
      method,
      body: typeof fetchOptions.body === 'string' ? fetchOptions.body : undefined,
      headers: fetchOptions.headers as Record<string, string> | undefined,
      description: offlineDescription || `${method} ${url}`,
    })
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return fetch(url, fetchOptions)
}
