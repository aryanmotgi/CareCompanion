import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCheck = vi.fn().mockResolvedValue({ success: true })
const mockFindFirst = vi.fn()
const mockSetWhere = vi.fn().mockResolvedValue(undefined)
const mockSet = vi.fn(() => ({ where: mockSetWhere }))
const mockUpdate = vi.fn(() => ({ set: mockSet }))
const mockSendEmail = vi.fn().mockResolvedValue({ success: true })
const mockSign = vi.fn().mockResolvedValue('signed-jwt-token')

vi.mock('jose', () => ({
  SignJWT: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.setProtectedHeader = vi.fn().mockReturnValue(this)
    this.setExpirationTime = vi.fn().mockReturnValue(this)
    this.setIssuedAt = vi.fn().mockReturnValue(this)
    this.sign = mockSign
    return this
  }),
}))

vi.mock('@/lib/db', () => ({
  db: {
    query: { users: { findFirst: mockFindFirst } },
    update: mockUpdate,
  },
}))

vi.mock('@/lib/db/schema', () => ({
  users: { email: 'email', id: 'id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
}))

vi.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({
    check: mockCheck,
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockCheck.mockResolvedValue({ success: true })
  mockSendEmail.mockResolvedValue({ success: true })
  mockSetWhere.mockResolvedValue(undefined)
})

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/reset-password', () => {
  it('returns 200 for missing email body (no enumeration)', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toContain('If an account exists')
  })

  it('returns 200 for invalid email type (no enumeration)', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ email: 12345 }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toContain('If an account exists')
  })

  it('returns 200 when rate limited (no enumeration)', async () => {
    mockCheck.mockResolvedValueOnce({ success: false })

    const { POST } = await import('../route')
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toContain('If an account exists')
    // DB should not have been queried
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('returns 200 when user not found (no enumeration)', async () => {
    mockFindFirst.mockResolvedValueOnce(undefined)

    const { POST } = await import('../route')
    const res = await POST(makeRequest({ email: 'nobody@example.com' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toContain('If an account exists')
  })

  it('stores nonce, signs JWT, sends email, returns 200 when user found', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'user-1', email: 'user@example.com' })

    const { POST } = await import('../route')
    const res = await POST(makeRequest({ email: 'user@example.com' }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toContain('If an account exists')

    // Verify nonce was stored
    expect(mockUpdate).toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storedData = (mockSet as any).mock.calls[0][0]
    expect(storedData.resetNonce).toBeDefined()
    expect(typeof storedData.resetNonce).toBe('string')

    // Verify JWT was signed
    expect(mockSign).toHaveBeenCalled()

    // Verify email was sent
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Reset your CareCompanion password',
      }),
    )
  })

  it('returns 500 when email send fails', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'user-1', email: 'user@example.com' })
    mockSendEmail.mockResolvedValueOnce({ success: false, reason: 'SMTP down' })

    const { POST } = await import('../route')
    const res = await POST(makeRequest({ email: 'user@example.com' }))

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain("couldn't send")
  })

  it('returns 500 when DB throws', async () => {
    mockFindFirst.mockRejectedValueOnce(new Error('DB down'))

    const { POST } = await import('../route')
    const res = await POST(makeRequest({ email: 'user@example.com' }))

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('Something went wrong')
  })
})
