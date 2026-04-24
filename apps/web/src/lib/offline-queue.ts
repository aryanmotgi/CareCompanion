type QueuedMutation = {
  id: string
  url: string
  method: string
  body?: string
  headers?: Record<string, string>
  timestamp: number
  description: string
}

const STORAGE_KEY = 'cc-offline-queue'

function getQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedMutation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

export function getQueuedCount(): number {
  return getQueue().length
}

export async function flushQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = getQueue()
  if (queue.length === 0) return { succeeded: 0, failed: 0 }

  let succeeded = 0
  let failed = 0
  const remaining: QueuedMutation[] = []

  for (const mutation of queue) {
    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers ? { ...mutation.headers } : { 'Content-Type': 'application/json' },
        body: mutation.body,
      })
      if (res.ok) {
        succeeded++
      } else {
        remaining.push(mutation)
        failed++
      }
    } catch {
      remaining.push(mutation)
      failed++
    }
  }

  saveQueue(remaining)
  window.dispatchEvent(new CustomEvent('offline-queue-change', { detail: { count: remaining.length } }))
  return { succeeded, failed }
}

