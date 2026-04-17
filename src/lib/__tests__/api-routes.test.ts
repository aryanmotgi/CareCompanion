import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDbUser = { id: 'user-123', email: 'test@example.com', cognitoSub: 'cognito-sub-123', displayName: 'Test User', isDemo: false, createdAt: new Date() }

vi.mock('@/lib/api-helpers', () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({ user: mockDbUser, error: null }),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'profile-1', patientName: 'Sarah', patientAge: 45 }]),
          orderBy: vi.fn().mockResolvedValue([]),
          then: (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve),
        }),
        orderBy: vi.fn().mockResolvedValue([]),
        then: (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'mock-id-1' }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
        then: (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({
    check: () => ({ success: true, remaining: 5 }),
  }),
  checkRateLimit: () => ({ allowed: true }),
  resetRateLimits: vi.fn(),
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
      expect(body.ok).toBe(true)
      expect(body.data.counts).toBeDefined()
      expect(typeof body.data.counts.medications).toBe('number')
      expect(typeof body.data.counts.labs).toBe('number')
      expect(typeof body.data.counts.appointments).toBe('number')
      expect(typeof body.data.counts.doctors).toBe('number')
    })
  })

  describe('GET /api/health', () => {
    it('returns 200 with status field', async () => {
      // Set env vars for health check
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
