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
      headers['Authorization'] = `Bearer ${token}`
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
    journal: {
      list: (days = 30) =>
        apiFetch(config, `/api/journal?days=${days}`, { method: 'GET' }) as Promise<{
          ok: boolean
          data: { entries: Array<{
            id: string
            date: string
            mood: string | null
            energy: string | null
            painLevel: number | null
            sleepHours: string | null
            symptoms: string[]
            notes: string | null
          }> }
        }>,
    },
    doctors: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/records/doctors?care_profile_id=${careProfileId}`, { method: 'GET' }) as Promise<{
          ok: boolean
          data: Array<{
            id: string
            name: string
            specialty: string | null
            phone: string | null
            notes: string | null
          }>
        }>,
    },
    careTeam: {
      list: () =>
        apiFetch(config, '/api/care-team', { method: 'GET' }) as Promise<{
          members: Array<{
            id: string
            userId: string
            role: string
            email: string | null
            display_name: string
            joinedAt: string | null
          }>
          invites: Array<{ id: string; invitedEmail: string; role: string }>
          role: string | null
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
        onboardingCompleted: boolean
      }>,
    csrfToken: () =>
      apiFetch(config, '/api/csrf-token', { method: 'GET' }) as Promise<{ csrfToken: string }>,
    conversations: {
      list: () =>
        apiFetch(config, '/api/conversations', { method: 'GET' }) as Promise<{
          ok: boolean
          data: Array<{
            id: string
            title: string | null
            tags: string[]
            lastMessagePreview: string | null
            createdAt: string
            updatedAt: string
            messageCount: number
          }>
        }>,
      create: () =>
        apiFetch(config, '/api/conversations', { method: 'POST' }) as Promise<{
          id: string
          title: string | null
          tags: string[]
          createdAt: string
          updatedAt: string
        }>,
      get: (id: string) =>
        apiFetch(config, `/api/conversations/${id}`, { method: 'GET' }) as Promise<{
          ok: boolean
          data: {
            conversation: { id: string; title: string | null; tags: string[] }
            messages: Array<{ id: string; role: string; content: string; createdAt: string }>
          }
        }>,
      delete: (id: string) =>
        apiFetch(config, `/api/conversations/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean; data: { deleted: boolean } }>,
    },
    chat: {
      send: async (
        messages: Array<{ role: 'user' | 'assistant'; content: string }>,
        csrfToken: string,
        conversationId?: string,
      ) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        }

        if (config.getToken) {
          const token = await config.getToken()
          if (token) {
            headers['Authorization'] = `Bearer ${token}`
          }
        }

        const res = await fetch(`${config.baseUrl}/api/chat/mobile`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ messages, conversationId }),
        })

        if (!res.ok) {
          throw new Error(`Chat API error ${res.status}: ${await res.text()}`)
        }

        const data = await res.json() as { content: string; conversationId: string }
        return { content: data.content || null, conversationId: data.conversationId }
      },
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
