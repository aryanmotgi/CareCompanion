import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Supabase server client (used by most routes for auth)
// ---------------------------------------------------------------------------
const mockUser = { id: 'user-123', email: 'test@example.com' }

const makeChainable = (data: unknown = [], error: unknown = null) => {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve({ data, error }),
    delete: () => chain,
    update: () => chain,
    upsert: () => chain,
    insert: () => ({ select: () => Promise.resolve({ data, error }) }),
    then: (resolve: (v: unknown) => void) => Promise.resolve({ data, error }).then(resolve),
  }
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => Promise.resolve({ data: { user: mockUser } }),
    },
    from: (table: string) => {
      if (table === 'lab_results') {
        return makeChainable([
          { id: '1', user_id: 'user-123', test_name: 'WBC', value: '5000', unit: 'cells/mcL', reference_range: '4000-11000', is_abnormal: false, date_taken: '2026-04-01', source: 'conversation', created_at: '2026-04-01T00:00:00Z' },
        ])
      }
      return makeChainable()
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'care_profiles') {
        return makeChainable({ id: 'profile-1', patient_name: 'Sarah' })
      }
      // For seed-demo inserts, return arrays with IDs
      return makeChainable([{ id: 'mock-id-1' }, { id: 'mock-id-2' }])
    },
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({
    check: () => ({ success: true, remaining: 5 }),
  }),
  checkRateLimit: () => ({ allowed: true }),
  resetRateLimits: vi.fn(),
}))

// Mock next/headers for createClient
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}))

describe('API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/seed-demo', () => {
    it('returns success with counts', async () => {
      const { POST } = await import('@/app/api/seed-demo/route')
      const req = new Request('http://localhost:3000/api/seed-demo', {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
      })

      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.counts).toBeDefined()
      expect(typeof body.counts.medications).toBe('number')
      expect(typeof body.counts.labs).toBe('number')
      expect(typeof body.counts.appointments).toBe('number')
      expect(typeof body.counts.doctors).toBe('number')
    })
  })

  describe('GET /api/health', () => {
    it('returns 200 with status field', async () => {
      // Set env vars for health check
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
      process.env.ANTHROPIC_API_KEY = 'test-key'

      const { GET } = await import('@/app/api/health/route')
      const req = new Request('http://localhost:3000/api/health')

      const res = await GET(req)
      const body = await res.json()

      expect([200, 503]).toContain(res.status)
      expect(body.status).toBeDefined()
      expect(['healthy', 'degraded']).toContain(body.status)
      expect(body.timestamp).toBeDefined()
    })
  })

  describe('POST /api/reminders/respond', () => {
    it('returns 400 when log_id is missing', async () => {
      const { POST } = await import('@/app/api/reminders/respond/route')
      const req = new Request('http://localhost:3000/api/reminders/respond', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'taken' }),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 when status is invalid', async () => {
      const { POST } = await import('@/app/api/reminders/respond/route')
      const req = new Request('http://localhost:3000/api/reminders/respond', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ log_id: 'log-1', status: 'invalid' }),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('accepts valid log_id and status', async () => {
      const { POST } = await import('@/app/api/reminders/respond/route')
      const req = new Request('http://localhost:3000/api/reminders/respond', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ log_id: 'log-1', status: 'taken' }),
      })

      const res = await POST(req)
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data.success).toBe(true)
    })
  })

  describe('GET /api/labs/trends', () => {
    it('returns trend data structure', async () => {
      const { GET } = await import('@/app/api/labs/trends/route')

      const res = await GET(new Request('http://localhost/api/labs/trends'))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data).toBeDefined()
      expect(body.data.trends).toBeDefined()
      expect(Array.isArray(body.data.trends)).toBe(true)
      expect(body.data.overall_status).toBeDefined()
      expect(body.data.red_flags).toBeDefined()
    })
  })
})
