import { describe, it, expect } from 'vitest'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response'

describe('api-response', () => {
  describe('apiSuccess', () => {
    it('returns ok:true with data', async () => {
      const res = apiSuccess({ name: 'test' })
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toEqual({ name: 'test' })
      expect(res.status).toBe(200)
    })

    it('accepts custom status code', async () => {
      const res = apiSuccess({ id: '123' }, 201)
      expect(res.status).toBe(201)
    })

    it('handles null data', async () => {
      const res = apiSuccess(null)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toBeNull()
    })

    it('handles array data', async () => {
      const res = apiSuccess([1, 2, 3])
      const body = await res.json()
      expect(body.data).toEqual([1, 2, 3])
    })
  })

  describe('apiError', () => {
    it('returns ok:false with error message', async () => {
      const res = apiError('Something broke', 400)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe('Something broke')
      expect(res.status).toBe(400)
    })

    it('includes error code when provided', async () => {
      const res = apiError('Not found', 404, { code: 'NOT_FOUND' })
      const body = await res.json()
      expect(body.code).toBe('NOT_FOUND')
    })

    it('includes details when provided', async () => {
      const res = apiError('Rate limited', 429, { details: { retry_after_ms: 5000 } })
      const body = await res.json()
      expect(body.details).toEqual({ retry_after_ms: 5000 })
    })

    it('omits code and details when not provided', async () => {
      const res = apiError('Bad', 400)
      const body = await res.json()
      expect(body.code).toBeUndefined()
      expect(body.details).toBeUndefined()
    })
  })

  describe('ApiErrors', () => {
    it('unauthorized returns 401', async () => {
      const res = ApiErrors.unauthorized()
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.code).toBe('UNAUTHORIZED')
    })

    it('forbidden returns 403', async () => {
      const res = ApiErrors.forbidden()
      expect(res.status).toBe(403)
    })

    it('notFound returns 404 with custom resource name', async () => {
      const res = ApiErrors.notFound('Medication')
      const body = await res.json()
      expect(body.error).toBe('Medication not found')
      expect(res.status).toBe(404)
    })

    it('rateLimited returns 429', async () => {
      const res = ApiErrors.rateLimited(5000)
      const body = await res.json()
      expect(res.status).toBe(429)
      expect(body.details).toEqual({ retry_after_ms: 5000 })
    })

    it('badRequest returns 400', async () => {
      const res = ApiErrors.badRequest('Missing field')
      const body = await res.json()
      expect(body.error).toBe('Missing field')
      expect(res.status).toBe(400)
    })

    it('internal returns 500', async () => {
      const res = ApiErrors.internal()
      expect(res.status).toBe(500)
    })

    it('methodNotAllowed returns 405', async () => {
      const res = ApiErrors.methodNotAllowed()
      expect(res.status).toBe(405)
    })
  })
})
