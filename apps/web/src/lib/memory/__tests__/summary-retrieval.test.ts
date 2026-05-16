import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    execute: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

vi.mock('@/lib/memory/embed', () => ({
  embedQuery: vi.fn(async () => Array(768).fill(0.1)),
  toHalfvecLiteral: vi.fn((v: number[]) => `[${v.join(',')}]`),
}));

import { loadRelevantSummaries, SUMMARY_SCORE_MULTIPLIER } from '@/lib/memory/retrieve';

const USER_A = '00000000-0000-0000-0000-000000000001';

describe('loadRelevantSummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.execute.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns top-2 summaries by cosine similarity', async () => {
    dbMock.execute.mockResolvedValueOnce({
      rows: [
        { id: 's1', summary: 'CEA trending up', topics: ['labs'], similarity: 0.91, created_at: new Date() },
        { id: 's2', summary: 'Started new chemo', topics: ['medication'], similarity: 0.84, created_at: new Date() },
      ],
    });

    const result = await loadRelevantSummaries(USER_A, 'how are the labs');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('s1');
    expect(result[1].id).toBe('s2');
  });

  it('applies 0.7 score multiplier to each summary', async () => {
    dbMock.execute.mockResolvedValueOnce({
      rows: [{ id: 's1', summary: 'X', topics: [], similarity: 1.0, created_at: new Date() }],
    });

    const result = await loadRelevantSummaries(USER_A, 'q');
    expect(result[0].score).toBeCloseTo(0.7);
    expect(SUMMARY_SCORE_MULTIPLIER).toBe(0.7);
  });

  it('returns empty array when user has no summaries', async () => {
    dbMock.execute.mockResolvedValueOnce({ rows: [] });
    const result = await loadRelevantSummaries(USER_A, 'q');
    expect(result).toEqual([]);
  });

  it('returns empty array on empty query (no embed call)', async () => {
    const result = await loadRelevantSummaries(USER_A, '   ');
    expect(result).toEqual([]);
    expect(dbMock.execute).not.toHaveBeenCalled();
  });

  it('SQL scopes by user_id and ignores NULL embeddings', async () => {
    dbMock.execute.mockResolvedValueOnce({ rows: [] });
    await loadRelevantSummaries(USER_A, 'labs');

    const call = dbMock.execute.mock.calls[0]?.[0] as {
      queryChunks?: Array<{ value?: unknown } | unknown>;
    };
    const sqlText = (call.queryChunks ?? [])
      .map((c) => {
        if (c && typeof c === 'object' && 'value' in c && Array.isArray((c as { value: unknown[] }).value)) {
          return ((c as { value: unknown[] }).value).join(' ');
        }
        return '';
      })
      .join(' ')
      .toLowerCase();

    expect(sqlText).toContain('user_id');
    expect(sqlText).toContain('embedding is not null');
    expect(sqlText).toContain('limit 2');
  });
});
