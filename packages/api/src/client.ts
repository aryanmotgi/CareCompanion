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
      create: (data: Partial<Medication>, csrfToken: string) =>
        apiFetch(config, '/api/records/medications', {
          method: 'POST',
          headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify(data),
        }) as Promise<Medication>,
      delete: (id: string, csrfToken: string) =>
        apiFetch(config, '/api/records/medications', {
          method: 'DELETE',
          headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify({ id }),
        }) as Promise<{ ok: boolean }>,
    },
    interactions: {
      checkAll: (csrfToken: string) =>
        apiFetch(config, '/api/interactions/check', {
          method: 'POST',
          headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify({ check_all: true }),
        }) as Promise<{
          ok: boolean
          data: {
            interactions: Array<{
              drug_a: string
              drug_b: string
              severity: 'major' | 'moderate' | 'minor'
              description: string
              recommendation: string
            }>
            allergy_warnings: Array<{ medication: string; allergy: string; risk: string }>
            summary: string
            safe_to_combine: boolean
          }
        }>,
    },
    labResults: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/records/labs?care_profile_id=${careProfileId}`, { method: 'GET' }) as Promise<LabResult[]>,
    },
    appointments: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/records/appointments?care_profile_id=${careProfileId}`, { method: 'GET' }) as Promise<Appointment[]>,
      create: (data: Record<string, unknown>, csrfToken: string) =>
        apiFetch(config, '/api/records/appointments', {
          method: 'POST',
          headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify(data),
        }) as Promise<Appointment>,
      delete: (id: string, csrfToken: string) =>
        apiFetch(config, '/api/records/appointments', {
          method: 'DELETE',
          headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify({ id }),
        }) as Promise<{ ok: boolean }>,
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
      invite: (email: string, role: 'editor' | 'viewer', csrfToken: string) =>
        apiFetch(config, '/api/care-team/invite', {
          method: 'POST',
          body: JSON.stringify({ email, role }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ ok: true; data: { success: true; message: string } }>,
    },
    healthkit: {
      sync: (records: HealthKitRecord[]) =>
        apiFetch(config, '/api/healthkit/sync', {
          method: 'POST',
          body: JSON.stringify({ records }),
        }) as Promise<{ synced: number }>,
      replace: (records: HealthKitRecord[], options?: { keepCareProfile?: boolean }) =>
        apiFetch(config, '/api/healthkit/replace', {
          method: 'POST',
          body: JSON.stringify({ records, keepCareProfile: options?.keepCareProfile ?? false }),
        }) as Promise<{ synced: number; errors: number; deleted: { medications: number; appointments: number; labResults: number } }>,
      records: () =>
        apiFetch(config, '/api/healthkit/records') as Promise<{
          conditions: Array<{ id: string; code: string | null; display: string; clinicalStatus: string | null; onsetDateTime: string | null }>
          allergies: Array<{ id: string; code: string | null; display: string; reaction: string | null; criticality: string | null }>
          procedures: Array<{ id: string; code: string | null; display: string; performedDateTime: string | null }>
          immunizations: Array<{ id: string; code: string | null; display: string; occurrenceDateTime: string | null }>
        }>,
    },
    auth: {
      register: (data: { email: string; password: string; displayName: string }) =>
        apiFetch(config, '/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(data),
        }) as Promise<{ id: string }>,
    },
    careGroup: {
      create: (name: string, password: string, csrfToken: string) =>
        apiFetch(config, '/api/care-group', {
          method: 'POST',
          body: JSON.stringify({ name, password }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ id: string; name: string }>,
      join: (name: string, password: string, csrfToken: string) =>
        apiFetch(config, '/api/care-group/join', {
          method: 'POST',
          body: JSON.stringify({ name, password }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ id: string; name: string }>,
      invite: (careGroupId: string, csrfToken: string) =>
        apiFetch(config, '/api/care-group/invite', {
          method: 'POST',
          body: JSON.stringify({ careGroupId }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ token: string; url: string }>,
      mine: () =>
        apiFetch(config, '/api/care-group/mine', { method: 'GET' }) as Promise<{
          groups: Array<{ id: string; name: string; role: string; isOwner: boolean }>
        }>,
      status: (careGroupId: string) =>
        apiFetch(config, `/api/care-group/${careGroupId}/status`, { method: 'GET' }) as Promise<{
          joined: boolean
          name?: string
        }>,
      // ── 5-char code flow (migration 012) ────────────────────────────────────
      codeCurrent: (careGroupId: string) =>
        apiFetch(config, `/api/care-group/code?careGroupId=${encodeURIComponent(careGroupId)}`, { method: 'GET' }) as Promise<{
          code: string | null
          expiresAt?: string
          useCount?: number
          maxUses?: number
        }>,
      codeGenerate: (careGroupId: string, csrfToken: string) =>
        apiFetch(config, '/api/care-group/code', {
          method: 'POST',
          body: JSON.stringify({ careGroupId }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ code: string; expiresAt: string; useCount: number; maxUses: number }>,
      codeRotate: (careGroupId: string, csrfToken: string) =>
        apiFetch(config, '/api/care-group/code/rotate', {
          method: 'POST',
          body: JSON.stringify({ careGroupId }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ code: string; expiresAt: string; useCount: number; maxUses: number }>,
      codeRevoke: (careGroupId: string, csrfToken: string) =>
        apiFetch(config, '/api/care-group/code/revoke', {
          method: 'POST',
          body: JSON.stringify({ careGroupId }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ revoked: true }>,
      joinByCode: (code: string, relationship: string, csrfToken: string) =>
        apiFetch(config, '/api/care-group/join-by-code', {
          method: 'POST',
          body: JSON.stringify({ code, relationship }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ careGroupId: string; patientName: string | null; patientPhotoUrl: string | null }>,
      // ── Caregiver-first email fallback ──────────────────────────────────────
      requestJoinByEmail: (patientEmail: string, csrfToken: string) =>
        apiFetch(config, '/api/care-group/request-join', {
          method: 'POST',
          body: JSON.stringify({ patientEmail }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ sent: true }>,
      pendingRequests: () =>
        apiFetch(config, '/api/care-group/request-join', { method: 'GET' }) as Promise<{
          requests: Array<{
            id: string
            createdAt: string
            caregiverUserId: string
            caregiverDisplayName: string | null
            caregiverEmail: string
          }>
        }>,
      myOutgoingRequest: () =>
        apiFetch(config, '/api/care-group/request-join/mine', { method: 'GET' }) as Promise<{
          request: {
            id: string
            status: 'pending' | 'approved' | 'denied' | 'expired'
            createdAt: string
            resolvedAt: string | null
            patientUserId: string
          } | null
        }>,
      approveRequest: (id: string, relationship: string, careGroupId: string, csrfToken: string) =>
        apiFetch(config, `/api/care-group/request-join/${id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ relationship, careGroupId }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ approved: true; careGroupId: string }>,
      denyRequest: (id: string, csrfToken: string) =>
        apiFetch(config, `/api/care-group/request-join/${id}/deny`, {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ denied: true }>,
      updateRelationship: (careGroupId: string, relationship: string, csrfToken: string) =>
        apiFetch(config, '/api/care-group/member/relationship', {
          method: 'POST',
          body: JSON.stringify({ careGroupId, relationship }),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ updated: true }>,
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
    /**
     * Update care profile fields. Backend expects snake_case keys
     * (cancer_type, cancer_stage, treatment_phase, conditions, allergies,
     * onboarding_completed). See apps/web/src/app/api/records/profile/route.ts.
     */
    careProfile: {
      update: (data: Record<string, unknown>, csrfToken: string) =>
        apiFetch(config, '/api/records/profile', {
          method: 'PATCH',
          body: JSON.stringify(data),
          headers: { 'x-csrf-token': csrfToken },
        }) as Promise<{ ok: boolean; data?: unknown }>,
    },
    memories: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/memories?care_profile_id=${encodeURIComponent(careProfileId)}`, { method: 'GET' }) as Promise<{
          ok?: boolean
          updatedAt?: string | null
          data?: Array<{
            id: string
            category: string
            content: string
            updatedAt?: string | null
          }>
          memories?: Array<{
            id: string
            category: string
            content: string
            updatedAt?: string | null
          }>
        }>,
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
      list: (opts: { signal?: AbortSignal } = {}) =>
        apiFetch(config, '/api/conversations', { method: 'GET', signal: opts.signal }) as Promise<{
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
      get: (id: string, opts: { signal?: AbortSignal } = {}) =>
        apiFetch(config, `/api/conversations/${id}`, { method: 'GET', signal: opts.signal }) as Promise<{
          ok: boolean
          data: {
            conversation: { id: string; title: string | null; tags: string[] }
            messages: Array<{ id: string; role: string; content: string; createdAt: string }>
          }
        }>,
      delete: (id: string) =>
        apiFetch(config, `/api/conversations/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean; data: { deleted: boolean } }>,
    },
    careHub: {
      get: (careProfileId: string) =>
        apiFetch(config, `/api/care-hub?careProfileId=${encodeURIComponent(careProfileId)}`, { method: 'GET' }) as Promise<{
          ok: boolean
          data: {
            profile: Record<string, unknown> | null
            todayCheckin: {
              mood: number
              pain: number
              energy: string
              sleep: string
              checkedInAt: string
            } | null
            recentCheckins: Array<{
              mood: number
              pain: number
              energy: string
              sleep: string
              checkedInAt: string
            }>
            insights: Array<{
              id: string
              type: string
              severity: string
              title: string
              body: string
              data: {
                source?: string
                checkinCount?: number
                adherenceRate?: number | null
                cycleDay?: number | null
                cycleNumber?: number | null
                targetUserId?: string
              } | null
              createdAt: string
            }>
            medications: Array<Record<string, unknown>>
            activity: Array<Record<string, unknown>>
            upcoming: Array<Record<string, unknown>>
          }
        }>,
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
