import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock } = vi.hoisted(() => ({
  dbMock: { execute: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import { reserveBudget, recordUsage, estimateTokens } from '@/lib/budget';

const USER_ID = '00000000-0000-0000-0000-000000000001';

describe('estimateTokens', () => {
  it('returns ceil(len/4)', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });
});

describe('reserveBudget', () => {
  beforeEach(() => {
    dbMock.execute.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  it('first reservation under cap → ok=true', async () => {
    dbMock.execute.mockResolvedValueOnce({
      rows: [{ total_input: 1000, output_tokens: 0 }],
    });
    const r = await reserveBudget(USER_ID, 1000);
    expect(r.ok).toBe(true);
    expect(dbMock.execute).toHaveBeenCalledTimes(1);
  });

  it('reservation exceeding input cap → ok=false + rollback issued', async () => {
    dbMock.execute.mockResolvedValueOnce({
      rows: [{ total_input: 200_001, output_tokens: 0 }],
    });
    dbMock.execute.mockResolvedValueOnce({ rows: [] });
    const r = await reserveBudget(USER_ID, 5000);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/input/);
    expect(dbMock.execute).toHaveBeenCalledTimes(2);
  });

  it('output cap already exhausted → ok=false', async () => {
    dbMock.execute.mockResolvedValueOnce({
      rows: [{ total_input: 1000, output_tokens: 50_000 }],
    });
    dbMock.execute.mockResolvedValueOnce({ rows: [] });
    const r = await reserveBudget(USER_ID, 1000);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/output/);
  });

  it('concurrent reservations: only one succeeds when sum > cap', async () => {
    // First call: sees total_input = 150k (OK)
    dbMock.execute.mockResolvedValueOnce({
      rows: [{ total_input: 150_000, output_tokens: 0 }],
    });
    // Second call: sees total_input = 300k (OVER) → triggers rollback
    dbMock.execute.mockResolvedValueOnce({
      rows: [{ total_input: 300_000, output_tokens: 0 }],
    });
    dbMock.execute.mockResolvedValueOnce({ rows: [] });

    const [r1, r2] = await Promise.all([
      reserveBudget(USER_ID, 150_000),
      reserveBudget(USER_ID, 150_000),
    ]);
    const wins = [r1, r2].filter((r) => r.ok).length;
    expect(wins).toBe(1);
  });
});

describe('recordUsage', () => {
  beforeEach(() => {
    dbMock.execute.mockReset();
  });

  it('issues UPDATE with input/output/cache fields', async () => {
    dbMock.execute.mockResolvedValueOnce({ rows: [] });
    await recordUsage(USER_ID, 1000, {
      inputTokens: 1200,
      outputTokens: 200,
      cacheRead: 50,
      cacheCreate: 10,
    });
    expect(dbMock.execute).toHaveBeenCalledTimes(1);
  });
});
