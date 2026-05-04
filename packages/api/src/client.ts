import type { Medication, LabResult, Appointment, HealthKitRecord } from '@carecompanion/types'

export type EligibilityGap = {
  gapType: 'measurable' | 'conditional' | 'fixed'
  description: string
  verifiable: boolean
  metric?: string | null
  currentValue?: string | null
  requiredValue?: string | null
  unit?: string | null
}

export type TrialMatch = {
  nctId: string
  title: string
  matchScore: number
  matchCategory: string
  matchReasons: string[]
  disqualifyingFactors: string[]
  uncertainFactors: string[]
  eligibilityGaps: EligibilityGap[] | null
  phase: string | null
  enrollmentStatus: string | null
  locations: Array<{ city?: string; state?: string; country?: string }> | null
  trialUrl: string | null
  stale: boolean
  updatedAt?: string | null
}

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
    community: {
      list: (params: { cancerType?: string; limit?: number; offset?: number } = {}) => {
        const q = new URLSearchParams()
        if (params.cancerType) q.set('cancerType', params.cancerType)
        q.set('limit', String(params.limit ?? 20))
        q.set('offset', String(params.offset ?? 0))
        return apiFetch(config, `/api/community?${q.toString()}`, { method: 'GET' }) as Promise<{
          ok: boolean
          data: Array<{
            id: string
            cancerType: string
            authorLabel: string
            title: string
            bodyPreview: string
            upvotes: number
            replyCount: number
            isPinned: boolean
            createdAt: string
            isOwn: boolean
          }>
        }>
      },
      create: (
        data: { title: string; body: string; cancerType: string; authorRole: 'caregiver' | 'patient' },
        csrfToken: string,
      ) =>
        apiFetch(config, '/api/community', {
          method: 'POST',
          body: JSON.stringify(data),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ ok: boolean; data: { id: string; authorLabel: string } }>,
      get: (id: string) =>
        apiFetch(config, `/api/community/${id}`, { method: 'GET' }) as Promise<{
          ok: boolean
          data: {
            post: {
              id: string
              authorLabel: string
              cancerType: string
              title: string
              body: string
              upvotes: number
              replyCount: number
              createdAt: string
              hasUpvoted: boolean
            }
            replies: Array<{
              id: string
              authorLabel: string
              body: string
              upvotes: number
              createdAt: string
            }>
            totalReplies: number
          }
        }>,
      reply: (id: string, body: string, csrfToken: string) =>
        apiFetch(config, `/api/community/${id}`, {
          method: 'POST',
          body: JSON.stringify({ body }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ ok: boolean; data: { id: string; authorLabel: string; body: string; upvotes: number; createdAt: string } }>,
      upvote: (id: string, csrfToken: string) =>
        apiFetch(config, `/api/community/${id}/upvote`, {
          method: 'POST',
          body: JSON.stringify({ targetType: 'post' }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ ok: boolean; data: { action: 'added' | 'removed' } }>,
    },
    trials: {
      getMatches: () =>
        apiFetch(config, '/api/trials/matches', { method: 'GET' }) as Promise<{
          matched: TrialMatch[]
          close: TrialMatch[]
        }>,
      getSaved: () =>
        apiFetch(config, '/api/trials/saved', { method: 'GET' }) as Promise<
          Array<{ nctId: string; interestStatus: string }>
        >,
      runMatch: (csrfToken: string) =>
        apiFetch(config, '/api/trials/match', {
          method: 'POST',
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ matched: TrialMatch[]; close: TrialMatch[]; refreshedAt: string }>,
      saveTrial: (nctId: string, csrfToken: string) =>
        apiFetch(config, '/api/trials/save', {
          method: 'POST',
          body: JSON.stringify({ nctId }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ ok: boolean }>,
      updateSaved: (nctId: string, interestStatus: string, csrfToken: string) =>
        apiFetch(config, `/api/trials/saved/${nctId}`, {
          method: 'PATCH',
          body: JSON.stringify({ interestStatus }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ ok: boolean }>,
    },
    updateMe: (data: Record<string, unknown>, csrfToken: string) =>
      apiFetch(config, '/api/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'x-csrf-token': csrfToken },
      }) as Promise<{ ok: boolean }>,
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
