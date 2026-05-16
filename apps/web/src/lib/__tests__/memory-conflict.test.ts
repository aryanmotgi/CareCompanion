import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    execute: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import { findCosineDuplicate, bumpSeenCount } from '@/lib/memory-conflict';

const USER_A = '00000000-0000-0000-0000-000000000001';
const USER_B = '00000000-0000-0000-0000-000000000002';

const EMB_LIT = `[${Array(768).fill(0.1).join(',')}]`;

type DrizzleSqlCall = {
  queryChunks?: Array<{ value?: unknown } | string | unknown>;
};

function extractSqlText(call: DrizzleSqlCall | undefined): string {
  if (!call?.queryChunks) return '';
  return call.queryChunks
    .map((c) => {
      if (c && typeof c === 'object' && 'value' in c && Array.isArray((c as { value: unknown[] }).value)) {
        return ((c as { value: unknown[] }).value).join(' ');
      }
      return '';
    })
    .join(' ')
    .toLowerCase();
}

function extractParams(call: DrizzleSqlCall | undefined): unknown[] {
  if (!call?.queryChunks) return [];
  return call.queryChunks.filter(
    (c) => !(c && typeof c === 'object' && 'value' in c && Array.isArray((c as { value: unknown[] }).value)),
  );
}

describe('findCosineDuplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.execute.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns duplicateId when cosine > 0.88 for same user+category', async () => {
    dbMock.execute.mockResolvedValueOnce({
      rows: [{ id: 'dup-uuid', similarity: 0.95 }],
    });

    const result = await findCosineDuplicate(USER_A, 'medication', EMB_LIT);
    expect(result).toEqual({ duplicateId: 'dup-uuid' });
    expect(dbMock.execute).toHaveBeenCalledTimes(1);
  });

  it('returns null at exact threshold 0.88 (strict greater-than)', async () => {
    dbMock.execute.mockResolvedValueOnce({
      rows: [{ id: 'edge-uuid', similarity: 0.88 }],
    });

    const result = await findCosineDuplicate(USER_A, 'medication', EMB_LIT);
    expect(result).toEqual({ duplicateId: null });
  });

  it('returns null when top-similarity row is below threshold', async () => {
    dbMock.execute.mockResolvedValueOnce({
      rows: [{ id: 'low-uuid', similarity: 0.87 }],
    });

    const result = await findCosineDuplicate(USER_A, 'medication', EMB_LIT);
    expect(result).toEqual({ duplicateId: null });
  });

  it('scopes by user_id — SQL filters on the supplied user id', async () => {
    dbMock.execute.mockResolvedValueOnce({ rows: [] });

    await findCosineDuplicate(USER_B, 'condition', EMB_LIT);

    const params = extractParams(dbMock.execute.mock.calls[0]?.[0]);
    expect(params).toContain(USER_B);
    expect(params).toContain('condition');
  });

  it('returns null when no rows for this user+category', async () => {
    dbMock.execute.mockResolvedValueOnce({ rows: [] });

    const result = await findCosineDuplicate(USER_A, 'allergy', EMB_LIT);
    expect(result).toEqual({ duplicateId: null });
  });

  it('returns null when embedding literal is empty string (safety guard)', async () => {
    const result = await findCosineDuplicate(USER_A, 'medication', '');
    expect(result).toEqual({ duplicateId: null });
    expect(dbMock.execute).not.toHaveBeenCalled();
  });

  it('ignores soft-deleted rows (valid_to filter in SQL)', async () => {
    dbMock.execute.mockResolvedValueOnce({ rows: [] });

    await findCosineDuplicate(USER_A, 'medication', EMB_LIT);

    const sqlText = extractSqlText(dbMock.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('valid_to is null');
  });

  it('only considers rows with embeddings (NULL embedding excluded)', async () => {
    dbMock.execute.mockResolvedValueOnce({ rows: [] });

    await findCosineDuplicate(USER_A, 'medication', EMB_LIT);

    const sqlText = extractSqlText(dbMock.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('embedding is not null');
  });
});

describe('bumpSeenCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.execute.mockReset();
  });

  it('increments seen_count and refreshes last_referenced on matched id', async () => {
    dbMock.execute.mockResolvedValueOnce({ rows: [] });
    await bumpSeenCount('dup-uuid');

    const sqlText = extractSqlText(dbMock.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('seen_count');
    expect(sqlText).toContain('last_referenced');

    const params = extractParams(dbMock.execute.mock.calls[0]?.[0]);
    expect(params).toContain('dup-uuid');
  });
});
