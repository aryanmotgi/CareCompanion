import { describe, it, expect } from 'vitest'
import {
  partitionReadyEntries,
  nextRetryState,
  BACKOFF_MS,
  MAX_ATTEMPTS,
  type RetryQueueEntry,
} from '../pure'

type Entry = RetryQueueEntry & { id: string; lastError: string | null }

const T = 1_000_000_000_000 // fixed "now" anchor

function e(id: string, nextAttemptAt: number, attempt = 0): Entry {
  return { id, nextAttemptAt, attempt, lastError: null }
}

describe('partitionReadyEntries', () => {
  it('separates ready (nextAttemptAt <= now) from waiting', () => {
    const queue = [
      e('a', T - 1000),
      e('b', T + 5000),
      e('c', T),
      e('d', T + 60_000),
    ]
    const { ready, waiting } = partitionReadyEntries(queue, T)
    expect(ready.map((x) => x.id)).toEqual(['a', 'c'])
    expect(waiting.map((x) => x.id)).toEqual(['b', 'd'])
  })

  it('returns empty arrays for empty input', () => {
    expect(partitionReadyEntries([], T)).toEqual({ ready: [], waiting: [] })
  })

  it('marks every entry ready if all are due', () => {
    const queue = [e('a', T - 1), e('b', T - 100)]
    const { ready, waiting } = partitionReadyEntries(queue, T)
    expect(ready).toHaveLength(2)
    expect(waiting).toHaveLength(0)
  })

  it('marks every entry waiting if none are due', () => {
    const queue = [e('a', T + 1), e('b', T + 100)]
    const { ready, waiting } = partitionReadyEntries(queue, T)
    expect(ready).toHaveLength(0)
    expect(waiting).toHaveLength(2)
  })
})

describe('nextRetryState', () => {
  it('bumps attempt + sets nextAttemptAt with the BACKOFF series', () => {
    const entry = e('a', T - 1, 0)
    const out = nextRetryState(entry, T, 'boom')
    expect(out).not.toBeNull()
    expect(out!.attempt).toBe(1)
    expect(out!.nextAttemptAt).toBe(T + BACKOFF_MS[1]!)
    expect(out!.lastError).toBe('boom')
    expect(out!.id).toBe('a')
  })

  it('progresses through the backoff series across retries', () => {
    let entry: Entry | null = e('a', T - 1, 0)
    const expected: number[] = []
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      entry = nextRetryState(entry as Entry, T, 'still failing')
      expect(entry).not.toBeNull()
      expected.push(BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)]!)
    }
    // The last step before drop should use the capped final delay.
    expect((entry as Entry).nextAttemptAt).toBe(T + BACKOFF_MS[BACKOFF_MS.length - 1]!)
  })

  it('returns null when attempt+1 reaches MAX_ATTEMPTS (drop signal)', () => {
    const entry = e('a', T, MAX_ATTEMPTS - 1)
    expect(nextRetryState(entry, T, 'final')).toBeNull()
  })

  it('preserves arbitrary extra fields on the entry', () => {
    const entry = { ...e('a', T - 1, 0), payload: { foo: 'bar' } }
    const out = nextRetryState(entry, T, 'err')
    expect(out).not.toBeNull()
    expect((out as typeof entry & { lastError: string }).payload).toEqual({ foo: 'bar' })
  })
})
