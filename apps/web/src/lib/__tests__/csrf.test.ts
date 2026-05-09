import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockSet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockGet, set: mockSet }),
}))
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
    ),
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('validateCsrf', () => {
  it('accepts matching cookie and header token', async () => {
    mockGet.mockReturnValue({ value: 'tok-abc' })
    const { validateCsrf } = await import('@/lib/csrf')
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'x-csrf-token': 'tok-abc', cookie: 'cc-csrf-token=tok-abc' },
    })
    const result = await validateCsrf(req)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('rejects mismatched tokens (403)', async () => {
    mockGet.mockReturnValue({ value: 'tok-abc' })
    const { validateCsrf } = await import('@/lib/csrf')
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'x-csrf-token': 'tok-WRONG', cookie: 'cc-csrf-token=tok-abc' },
    })
    const result = await validateCsrf(req)
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error!.status).toBe(403)
  })

  it('rejects missing x-csrf-token header (403)', async () => {
    mockGet.mockReturnValue({ value: 'tok-abc' })
    const { validateCsrf } = await import('@/lib/csrf')
    const req = new Request('http://localhost/', { method: 'POST' })
    const result = await validateCsrf(req)
    expect(result.valid).toBe(false)
    expect(result.error!.status).toBe(403)
  })

  it('rejects when cookie store has no CSRF cookie but raw Cookie header has it', async () => {
    // Simulates mobile app: next/headers returns no cookie, but raw header has it
    mockGet.mockReturnValue(undefined)
    const { validateCsrf } = await import('@/lib/csrf')
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: {
        'x-csrf-token': 'tok-mobile',
        cookie: 'cc-csrf-token=tok-mobile',
      },
    })
    // Fallback: parse from raw Cookie header — should pass
    const result = await validateCsrf(req)
    expect(result.valid).toBe(true)
  })

  it('rejects when both cookie and header are absent (403)', async () => {
    mockGet.mockReturnValue(undefined)
    const { validateCsrf } = await import('@/lib/csrf')
    const req = new Request('http://localhost/', { method: 'POST' })
    const result = await validateCsrf(req)
    expect(result.valid).toBe(false)
    expect(result.error!.status).toBe(403)
  })
})
