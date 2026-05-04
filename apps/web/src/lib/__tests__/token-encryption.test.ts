import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// Tested without real env vars so we can exercise all branches
describe('token-encryption', () => {
  const VALID_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes

  describe('encryptToken / decryptToken round-trip', () => {
    beforeEach(() => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY
    })
    afterEach(() => {
      delete process.env.TOKEN_ENCRYPTION_KEY
    })

    it('encrypts and decrypts back to the original plaintext', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/token-encryption')
      const plain = 'ya29.some-google-access-token'
      const encrypted = encryptToken(plain)
      expect(encrypted).toMatch(/^enc:v1:/)
      expect(decryptToken(encrypted)).toBe(plain)
    })

    it('each call produces a different ciphertext (random IV)', async () => {
      const { encryptToken } = await import('@/lib/token-encryption')
      const a = encryptToken('token')
      const b = encryptToken('token')
      expect(a).not.toBe(b)
    })
  })

  describe('encryptToken without key (dev fallback)', () => {
    beforeEach(() => { delete process.env.TOKEN_ENCRYPTION_KEY })

    it('returns plaintext when no key is set outside production', async () => {
      const { encryptToken } = await import('@/lib/token-encryption')
      const result = encryptToken('my-token')
      expect(result).toBe('my-token')
    })
  })

  describe('decryptToken legacy passthrough', () => {
    beforeEach(() => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY
    })
    afterEach(() => {
      delete process.env.TOKEN_ENCRYPTION_KEY
    })

    it('returns legacy plaintext token as-is (no enc:v1: prefix)', async () => {
      const { decryptToken } = await import('@/lib/token-encryption')
      expect(decryptToken('ya29.legacy-plain-token')).toBe('ya29.legacy-plain-token')
    })

    it('throws on malformed enc:v1: payload', async () => {
      const { decryptToken } = await import('@/lib/token-encryption')
      expect(() => decryptToken('enc:v1:badhex')).toThrow('Invalid encrypted token format')
    })
  })

  describe('signState / verifyState', () => {
    beforeEach(() => {
      process.env.OAUTH_STATE_SECRET = 'test-secret-for-hmac'
    })
    afterEach(() => {
      delete process.env.OAUTH_STATE_SECRET
    })

    it('signs and verifies a payload round-trip', async () => {
      const { signState, verifyState } = await import('@/lib/token-encryption')
      const payload = { userId: 'user-123' }
      const signed = signState(payload)
      expect(signed).toContain('.')
      const decoded = verifyState(signed)
      expect(decoded).toEqual(payload)
    })

    it('rejects a tampered signature', async () => {
      const { signState, verifyState } = await import('@/lib/token-encryption')
      const signed = signState({ userId: 'user-123' })
      const tampered = signed.slice(0, -4) + 'beef'
      expect(verifyState(tampered)).toBeNull()
    })

    it('rejects state with no dot when secret is set', async () => {
      const { verifyState } = await import('@/lib/token-encryption')
      expect(verifyState('nodothere')).toBeNull()
    })
  })

  describe('signState without secret (dev mode)', () => {
    beforeEach(() => {
      delete process.env.OAUTH_STATE_SECRET
      delete process.env.CRON_SECRET
    })

    it('returns unsigned base64url in dev', async () => {
      const { signState, verifyState } = await import('@/lib/token-encryption')
      const signed = signState({ userId: 'u1' })
      expect(signed).not.toContain('.')
      const decoded = verifyState(signed)
      expect(decoded).toEqual({ userId: 'u1' })
    })
  })
})
