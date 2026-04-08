import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyCronRequest } from '@/lib/cron-auth'

describe('cron-auth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('allows requests when CRON_SECRET is not set (development)', () => {
    delete process.env.CRON_SECRET

    const req = new Request('http://localhost:3000/api/sync/all')
    const result = verifyCronRequest(req)
    expect(result).toBeNull()
  })

  it('allows requests with valid Bearer token', () => {
    process.env.CRON_SECRET = 'test-secret-123'

    const req = new Request('http://localhost:3000/api/sync/all', {
      headers: { authorization: 'Bearer test-secret-123' },
    })
    const result = verifyCronRequest(req)
    expect(result).toBeNull()
  })

  it('blocks requests with wrong Bearer token', () => {
    process.env.CRON_SECRET = 'test-secret-123'

    const req = new Request('http://localhost:3000/api/sync/all', {
      headers: { authorization: 'Bearer wrong-secret' },
    })
    const result = verifyCronRequest(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('blocks requests with no authorization header', () => {
    process.env.CRON_SECRET = 'test-secret-123'

    const req = new Request('http://localhost:3000/api/sync/all')
    const result = verifyCronRequest(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })
})
