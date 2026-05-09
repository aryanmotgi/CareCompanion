import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock api-response to avoid next/server resolution issues via NextResponse
// ---------------------------------------------------------------------------
vi.mock('@/lib/api-response', () => ({
  apiSuccess: (data: unknown) => Response.json({ ok: true, data }),
  apiError: (message: string, status = 400, extra?: Record<string, unknown>) =>
    Response.json({ ok: false, error: message, ...(extra ?? {}) }, { status }),
  ApiErrors: {
    rateLimited: () => Response.json({ ok: false, error: 'Too many requests' }, { status: 429 }),
    internal: () => Response.json({ ok: false, error: 'Internal server error' }, { status: 500 }),
    unauthorized: () => Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
  },
}))

// ---------------------------------------------------------------------------
// Mock api-helpers to avoid the next-auth → next/server import chain
// ---------------------------------------------------------------------------
vi.mock('@/lib/api-helpers', () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    user: { id: 'user-123', providerSub: 'cognito-123', email: 'test@example.com' },
    error: null,
  }),
  validateBody: (
    schema: { safeParse: (b: unknown) => { success: boolean; data?: unknown; error?: { issues: { path: unknown[]; message: string }[] } } },
    body: unknown,
  ) => {
    const r = schema.safeParse(body)
    if (!r.success) {
      const msg = r.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
      return { data: null, error: Response.json({ ok: false, error: 'Validation error', details: msg }, { status: 400 }) }
    }
    return { data: r.data, error: null }
  },
  parseBody: async (req: Request) => {
    try {
      const body = await req.clone().json()
      return { body, error: undefined }
    } catch {
      return { body: undefined, error: Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
    }
  },
}))

// ---------------------------------------------------------------------------
// Mock @/lib/db — Drizzle-compatible chainable query builder
// ---------------------------------------------------------------------------
const makeSelectChain = (rows: unknown[] = []) => {
  const promise = Promise.resolve(rows)
  const chain: Record<string, unknown> = {
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    catch: (fn: (e: unknown) => unknown) => promise.catch(fn),
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
      promise.then(resolve, reject),
  }
  return chain
}

vi.mock('@/lib/db', () => {
  const TABLE_NAME = Symbol.for('drizzle:Name')

  return {
    db: {
      select: () => ({
        from: (table: Record<symbol, string>) => {
          const name = table[TABLE_NAME] ?? 'unknown'
          // Return a profile for care_profiles so seed-demo can proceed past the guard
          const rows = name === 'care_profiles'
            ? [{ id: 'profile-1', patientName: 'Sarah' }]
            : []
          return makeSelectChain(rows)
        },
      }),
      insert: () => ({
        values: () => {
          const p = Promise.resolve([])
          return {
            returning: () => p,
            onConflictDoUpdate: () => ({
              then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => p.then(resolve, reject),
            }),
            then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => p.then(resolve, reject),
          }
        },
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve([]),
        }),
      }),
      delete: () => ({
        where: () => Promise.resolve([]),
      }),
    },
  }
})

// ---------------------------------------------------------------------------
// Mock CSRF — always valid
// ---------------------------------------------------------------------------
vi.mock('@/lib/csrf', () => ({
  validateCsrf: () => ({ valid: true, error: null }),
}))

// ---------------------------------------------------------------------------
// Mock rate-limit — always allow
// ---------------------------------------------------------------------------
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({
    check: () => ({ success: true, remaining: 5 }),
  }),
  checkRateLimit: () => ({ allowed: true }),
  resetRateLimits: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock logger (used by health route)
// ---------------------------------------------------------------------------
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
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
