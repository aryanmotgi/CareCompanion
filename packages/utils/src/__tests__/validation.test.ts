import { describe, it, expect } from 'vitest'
import { medicationSchema, labResultSchema, registerSchema } from '../validation'

describe('medicationSchema', () => {
  it('accepts valid medication', () => {
    expect(medicationSchema.safeParse({ name: 'Aspirin' }).success).toBe(true)
  })
  it('rejects empty name', () => {
    expect(medicationSchema.safeParse({ name: '' }).success).toBe(false)
  })
})

describe('labResultSchema', () => {
  it('accepts valid lab result', () => {
    expect(labResultSchema.safeParse({ testName: 'CBC', value: '12.5', dateTaken: '2026-04-01' }).success).toBe(true)
  })
  it('rejects missing value', () => {
    expect(labResultSchema.safeParse({ testName: 'CBC', dateTaken: '2026-04-01' }).success).toBe(false)
  })
})

describe('registerSchema', () => {
  it('rejects short password', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: 'short', displayName: 'Test' }).success).toBe(false)
  })
  it('rejects invalid email', () => {
    expect(registerSchema.safeParse({ email: 'not-email', password: 'validpass', displayName: 'Test' }).success).toBe(false)
  })
  it('accepts valid input', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: 'validpass', displayName: 'Test' }).success).toBe(true)
  })
})
