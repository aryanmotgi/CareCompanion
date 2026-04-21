import type { Medication, LabResult, Appointment, HealthKitRecord } from '@carecompanion/types'

interface ApiClientConfig {
  baseUrl: string
  getToken?: () => Promise<string | null>
}

async function apiFetch(
  config: ApiClientConfig,
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (config.getToken) {
    const token = await config.getToken()
    if (token) headers['Cookie'] = `next-auth.session-token=${token}`
  }

  const res = await fetch(`${config.baseUrl}${path}`, { ...options, headers })

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`)
  }

  return res.json()
}

export function createApiClient(config: ApiClientConfig) {
  return {
    medications: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/medications?careProfileId=${careProfileId}`, { method: 'GET' }) as Promise<Medication[]>,
      create: (data: Partial<Medication>) =>
        apiFetch(config, '/api/medications', { method: 'POST', body: JSON.stringify(data) }) as Promise<Medication>,
    },
    labResults: {
      list: (userId: string) =>
        apiFetch(config, `/api/lab-results?userId=${userId}`, { method: 'GET' }) as Promise<LabResult[]>,
    },
    appointments: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/appointments?careProfileId=${careProfileId}`, { method: 'GET' }) as Promise<Appointment[]>,
    },
    healthkit: {
      sync: (records: HealthKitRecord[]) =>
        apiFetch(config, '/api/healthkit/sync', {
          method: 'POST',
          body: JSON.stringify({ records }),
        }) as Promise<{ synced: number }>,
    },
    auth: {
      exchangeCode: (code: string) =>
        apiFetch(config, '/api/auth/mobile-token/exchange', {
          method: 'POST',
          body: JSON.stringify({ code }),
        }) as Promise<{ sessionToken: string }>,
      register: (data: { email: string; password: string; displayName: string }) =>
        apiFetch(config, '/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(data),
        }) as Promise<{ id: string }>,
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
