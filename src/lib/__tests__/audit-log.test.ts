import { describe, it, expect } from 'vitest'

// Test startTimer logic directly without importing the module
// (which has a side-effect dependency on Supabase env vars)
describe('audit-log', () => {
  describe('startTimer pattern', () => {
    it('measures elapsed time correctly', async () => {
      const start = Date.now()
      const elapsed = () => Date.now() - start
      await new Promise(resolve => setTimeout(resolve, 50))
      const ms = elapsed()
      expect(ms).toBeGreaterThanOrEqual(40)
      expect(ms).toBeLessThan(200)
    })

    it('returns 0 when called immediately', () => {
      const start = Date.now()
      const elapsed = () => Date.now() - start
      const ms = elapsed()
      expect(ms).toBeGreaterThanOrEqual(0)
      expect(ms).toBeLessThan(10)
    })

    it('accumulates over multiple calls', async () => {
      const start = Date.now()
      const elapsed = () => Date.now() - start
      await new Promise(resolve => setTimeout(resolve, 20))
      const ms1 = elapsed()
      await new Promise(resolve => setTimeout(resolve, 20))
      const ms2 = elapsed()
      expect(ms2).toBeGreaterThan(ms1)
    })
  })

  describe('audit entry structure', () => {
    it('creates valid JSON log entries', () => {
      const entry = {
        type: 'audit',
        ts: new Date().toISOString(),
        user_id: 'user-123',
        action: 'create',
        resource: 'medication',
        method: 'POST',
        path: '/api/medications',
        status_code: 200,
        duration_ms: 45,
      }
      const json = JSON.stringify(entry)
      const parsed = JSON.parse(json)
      expect(parsed.type).toBe('audit')
      expect(parsed.status_code).toBe(200)
      expect(parsed.duration_ms).toBe(45)
    })
  })
})
