import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockJwtVerify = vi.fn()
const mockHash = vi.fn().mockResolvedValue('new-hashed-pw')
const mockFindFirst = vi.fn()
const mockSetWhere = vi.fn().mockResolvedValue(undefined)
const mockSet = vi.fn(() => ({ where: mockSetWhere }))
const mockUpdate = vi.fn(() => ({ set: mockSet }))

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}))

vi.mock('bcryptjs', () => ({
  default: { hash: mockHash },
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

beforeEach(() => {
  vi.clearAllMocks()
  mockHash.mockResolvedValue('new-hashed-pw')
  mockSetWhere.mockResolvedValue(undefined)
})

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/reset-password/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/reset-password/confirm', () => {
  it('returns 400 when token is missing', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ password: 'newpassword123' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Invalid request')
  })

  it('returns 400 when password is missing', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ token: 'some-token' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Invalid request')
  })

  it('returns 400 when password is too short', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ token: 'some-token', password: 'short' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('at least 8 characters')
  })

  it('returns 400 when JWT is invalid or expired', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('JWT expired'))

    const { POST } = await import('../route')
    const res = await POST(makeRequest({ token: 'expired-token', password: 'newpassword123' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('expired')
  })

  it('returns 400 when nonce does not match', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { email: 'user@example.com', nonce: 'nonce-from-token' },
    })
    mockFindFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      resetNonce: 'different-nonce',
    })

    const { POST } = await import('../route')
    const res = await POST(makeRequest({ token: 'valid-token', password: 'newpassword123' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('already been used')
  })

  it('returns 400 when user not found', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { email: 'gone@example.com', nonce: 'some-nonce' },
    })
    mockFindFirst.mockResolvedValueOnce(undefined)

    const { POST } = await import('../route')
    const res = await POST(makeRequest({ token: 'valid-token', password: 'newpassword123' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('already been used')
  })

  it('updates password, clears nonce, and returns 200 on success', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { email: 'user@example.com', nonce: 'matching-nonce' },
    })
    mockFindFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      resetNonce: 'matching-nonce',
    })

    const { POST } = await import('../route')
    const res = await POST(makeRequest({ token: 'valid-token', password: 'newpassword123' }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toContain('successfully')

    // Verify password was hashed and nonce was cleared
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload = (mockSet as any).mock.calls[0][0]
    expect(updatePayload.passwordHash).toBe('new-hashed-pw')
    expect(updatePayload.resetNonce).toBeNull()
  })

  it('returns 500 when bcrypt throws', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { email: 'user@example.com', nonce: 'matching-nonce' },
    })
    mockFindFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      resetNonce: 'matching-nonce',
    })
    mockHash.mockRejectedValueOnce(new Error('bcrypt failure'))

    const { POST } = await import('../route')
    const res = await POST(makeRequest({ token: 'valid-token', password: 'newpassword123' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('Something went wrong')
  })

  it('returns 500 when DB update throws', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { email: 'user@example.com', nonce: 'matching-nonce' },
    })
    mockFindFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      resetNonce: 'matching-nonce',
    })
    mockUpdate.mockImplementationOnce(() => {
      throw new Error('DB update failed')
    })

    const { POST } = await import('../route')
    const res = await POST(makeRequest({ token: 'valid-token', password: 'newpassword123' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('Something went wrong')
  })
})
