import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { select: vi.fn(), update: vi.fn() } }))
vi.mock('@/lib/api-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
  parseBody: vi.fn(),
}))
vi.mock('@/lib/api-response', () => ({
  apiError: (msg: string, status: number) => new Response(JSON.stringify({ error: msg }), { status }),
  apiSuccess: (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 }),
}))
vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn().mockResolvedValue({ valid: true, error: undefined }),
}))

import { PATCH } from '@/app/api/records/settings/route'
import { getAuthenticatedUser, parseBody } from '@/lib/api-helpers'
import { db } from '@/lib/db'

const mockUser = { id: 'user-1', email: 'test@example.com' }
const mockSettings = { id: 'settings-1' }

function makeChain(result: unknown) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.limit.mockResolvedValue([result])
  return chain
}

function makeUpdateChain() {
  const chain = { set: vi.fn(), where: vi.fn(), returning: vi.fn() }
  chain.set.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.returning.mockResolvedValue([{ aiPersonality: 'friendly' }])
  return chain
}

beforeEach(() => {
  vi.mocked(getAuthenticatedUser).mockResolvedValue({ user: mockUser as never, error: null })
  vi.mocked(db.select).mockReturnValue(makeChain(mockSettings) as never)
  vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never)
})

describe('PATCH /api/records/settings', () => {
  it('accepts valid ai_personality values', async () => {
    vi.mocked(parseBody).mockResolvedValue({ body: { ai_personality: 'friendly' }, error: undefined })
    const req = new Request('http://localhost/api/records/settings', { method: 'PATCH' })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })

  it('rejects invalid ai_personality value', async () => {
    vi.mocked(parseBody).mockResolvedValue({ body: { ai_personality: 'aggressive' }, error: undefined })
    const req = new Request('http://localhost/api/records/settings', { method: 'PATCH' })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('Invalid ai_personality')
  })

  it('accepts all three valid personality options', async () => {
    for (const val of ['professional', 'friendly', 'concise']) {
      vi.mocked(parseBody).mockResolvedValue({ body: { ai_personality: val }, error: undefined })
      const req = new Request('http://localhost/api/records/settings', { method: 'PATCH' })
      const res = await PATCH(req)
      expect(res.status).toBe(200)
    }
  })

  it('rejects body with no valid fields', async () => {
    vi.mocked(parseBody).mockResolvedValue({ body: { unknown_field: true }, error: undefined })
    const req = new Request('http://localhost/api/records/settings', { method: 'PATCH' })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it('accepts notification_preferences JSONB', async () => {
    vi.mocked(parseBody).mockResolvedValue({
      body: { notification_preferences: { medications: { enabled: false } } },
      error: undefined,
    })
    const req = new Request('http://localhost/api/records/settings', { method: 'PATCH' })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })
})
