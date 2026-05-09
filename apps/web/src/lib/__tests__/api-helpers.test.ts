import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'

// Mock modules that api-helpers imports at the top level
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { select: vi.fn(), query: {} } }))
vi.mock('@/lib/db/schema', () => ({ users: {} }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))
vi.mock('@/lib/api-response', async () => {
  const { NextResponse } = await import('next/server')
  return {
    apiError: (msg: string, status: number, opts?: { code?: string; details?: unknown }) => {
      const body = { ok: false, error: msg, ...(opts?.code ? { code: opts.code } : {}), ...(opts?.details ? { details: opts.details } : {}) }
      return NextResponse.json(body, { status })
    },
  }
})

const { validateBody, parseBody } = await import('../api-helpers')

describe('validateBody', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().min(0).optional(),
  })

  it('returns parsed data on valid input', () => {
    const result = validateBody(schema, { email: 'test@example.com', age: 25 })
    expect(result.error).toBeNull()
    expect(result.data).toEqual({ email: 'test@example.com', age: 25 })
  })

  it('returns error on invalid input', async () => {
    const result = validateBody(schema, { email: 'not-an-email' })
    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    const body = await result.error!.json()
    expect(body.error).toBe('Validation error')
    expect(result.error!.status).toBe(400)
  })

  it('returns error when required field is missing', async () => {
    const result = validateBody(schema, {})
    expect(result.data).toBeNull()
    expect(result.error!.status).toBe(400)
  })

  it('allows optional fields to be omitted', () => {
    const result = validateBody(schema, { email: 'test@example.com' })
    expect(result.error).toBeNull()
    expect(result.data).toEqual({ email: 'test@example.com' })
  })
})

describe('parseBody', () => {
  it('parses valid JSON body', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseBody(req)
    expect(result.error).toBeUndefined()
    expect(result.body).toEqual({ key: 'value' })
  })

  it('returns 400 on invalid JSON', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseBody(req)
    expect(result.body).toBeUndefined()
    expect(result.error).not.toBeUndefined()
    expect(result.error!.status).toBe(400)
  })

  it('returns 400 on empty body', async () => {
    const req = new Request('http://localhost', { method: 'POST' })
    const result = await parseBody(req)
    expect(result.body).toBeUndefined()
    expect(result.error!.status).toBe(400)
  })
})
