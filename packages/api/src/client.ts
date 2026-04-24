import type { Medication, LabResult, Appointment, HealthKitRecord } from '@carecompanion/types'

interface ApiClientConfig {
  baseUrl: string
  getToken?: () => Promise<string | null>
}

async function apiFetch(
  config: ApiClientConfig,
  path: string,
  options: RequestInit & { signal?: AbortSignal } = {}
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (config.getToken) {
    const token = await config.getToken()
    if (token) {
      // Production (HTTPS) uses the __Secure- prefix; dev uses the plain name.
      const isSecure = config.baseUrl.startsWith('https://')
      const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'
      headers['Cookie'] = `${cookieName}=${token}`
    }
  }

  const res = await fetch(`${config.baseUrl}${path}`, { ...options, headers, signal: options.signal })

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`)
  }

  return res.json()
}

export function createApiClient(config: ApiClientConfig) {
  return {
    medications: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/records/medications?care_profile_id=${careProfileId}`, { method: 'GET' }) as Promise<Medication[]>,
      create: (data: Partial<Medication>) =>
        apiFetch(config, '/api/records/medications', { method: 'POST', body: JSON.stringify(data) }) as Promise<Medication>,
    },
    labResults: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/records/labs?care_profile_id=${careProfileId}`, { method: 'GET' }) as Promise<LabResult[]>,
    },
    appointments: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/records/appointments?care_profile_id=${careProfileId}`, { method: 'GET' }) as Promise<Appointment[]>,
    },
    timeline: {
      list: (profileId: string, days = 7) =>
        apiFetch(config, `/api/timeline?profileId=${profileId}&days=${days}`, { method: 'GET' }) as Promise<{
          ok: true
          data: Array<{
            id: string
            type: 'medication' | 'appointment' | 'lab' | 'refill'
            title: string
            subtitle: string | null
            timestamp: string
            meta?: Record<string, unknown>
          }>
        }>,
    },
    healthkit: {
      sync: (records: HealthKitRecord[]) =>
        apiFetch(config, '/api/healthkit/sync', {
          method: 'POST',
          body: JSON.stringify({ records }),
        }) as Promise<{ synced: number }>,
    },
    auth: {
      register: (data: { email: string; password: string; displayName: string }) =>
        apiFetch(config, '/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(data),
        }) as Promise<{ id: string }>,
    },
    me: () =>
      apiFetch(config, '/api/me', { method: 'GET' }) as Promise<{
        userId: string
        email: string
        displayName: string
        careProfileId: string | null
        patientName: string | null
        emergencyContactName: string | null
        emergencyContactPhone: string | null
        cancerType: string | null
        cancerStage: string | null
        treatmentPhase: string | null
        allergies: string | null
        conditions: string | null
        role: string
        caregiverForName: string | null
      }>,
    csrfToken: () =>
      apiFetch(config, '/api/csrf-token', { method: 'GET' }) as Promise<{ csrfToken: string }>,
    chat: {
      send: async (
        messages: Array<{ role: 'user' | 'assistant'; content: string }>,
        csrfToken: string,
      ) => {
        // Convert flat messages to AI SDK UIMessage format with .parts
        const uiMessages = messages.map((m, i) => ({
          id: String(i),
          role: m.role,
          parts: [{ type: 'text' as const, text: m.content }],
          createdAt: new Date(),
        }))

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        }

        if (config.getToken) {
          const token = await config.getToken()
          if (token) {
            const isSecure = config.baseUrl.startsWith('https://')
            const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'
            headers['Cookie'] = `${cookieName}=${token}; cc-csrf-token=${csrfToken}`
          }
        }

        const res = await fetch(`${config.baseUrl}/api/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ messages: uiMessages }),
        })

        if (!res.ok) {
          throw new Error(`Chat API error ${res.status}: ${await res.text()}`)
        }

        // The chat route returns a streaming response — read full stream and extract text
        const text = await res.text()
        console.log('[Chat API] Raw response (first 500 chars):', text.slice(0, 500))
        const lines = text.split('\n').filter(Boolean)
        let content = ''
        for (const line of lines) {
          // AI SDK v3 format: 0:"text chunk"
          if (line.startsWith('0:')) {
            try {
              content += JSON.parse(line.slice(2))
            } catch {
              // skip non-JSON lines
            }
          }
          // AI SDK v4+ data stream format: text chunks in d: lines or plain text
          else if (line.startsWith('d:')) {
            try {
              const parsed = JSON.parse(line.slice(2))
              if (typeof parsed === 'string') content += parsed
              else if (parsed?.type === 'text-delta') content += parsed.textDelta || ''
            } catch {}
          }
          // Vercel AI SDK v6 format: data stream protocol
          else if (line.startsWith('2:')) {
            try {
              const arr = JSON.parse(line.slice(2))
              if (Array.isArray(arr)) {
                for (const item of arr) {
                  if (item?.type === 'text-delta') content += item.textDelta || ''
                }
              }
            } catch {}
          }
        }
        // Fallback: if no protocol lines matched, try reading as plain text
        if (!content && text && !text.includes('\n')) {
          content = text
        }
        return { content: content || null }
      },
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
