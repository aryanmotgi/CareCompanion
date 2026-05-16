import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock, generateTextMock } = vi.hoisted(() => ({
  dbMock: {
    execute: vi.fn(),
    update: vi.fn(),
  },
  generateTextMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: generateTextMock };
});

import {
  findCosineDuplicate,
  bumpSeenCount,
  resolveConflicts,
} from '@/lib/memory-conflict';
import type { Memory } from '@/lib/types';

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

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'mem-' + Math.random().toString(36).slice(2, 8),
    userId: USER_A,
    careProfileId: null,
    category: 'medication',
    fact: 'Eleanor takes Tamoxifen 10mg daily',
    source: 'conversation',
    confidence: 'high',
    createdAt: new Date(),
    lastReferenced: new Date(),
    validFrom: new Date(),
    validTo: null,
    polarity: 'asserted',
    status: 'active',
    subject: 'patient',
    ...overrides,
  };
}

describe('resolveConflicts (chunk 4: temporal contradiction)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.execute.mockReset();
    dbMock.update.mockReset();
    generateTextMock.mockReset();
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it('on conflict: closes old row via valid_to + status=historical (does NOT mutate fact)', async () => {
    const existing = makeMemory({
      fact: 'Eleanor takes Tamoxifen 10mg daily',
    });
    generateTextMock.mockResolvedValueOnce({
      text: 'Eleanor was on Tamoxifen 10mg; now on Tamoxifen 20mg',
    });

    await resolveConflicts(
      USER_A,
      'Eleanor takes Tamoxifen 20mg daily',
      'medication',
      [existing],
    );

    expect(dbMock.update).toHaveBeenCalled();
    const setCall = (dbMock.update.mock.results[0].value.set as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(setCall).toHaveProperty('validTo');
    expect(setCall).toHaveProperty('status', 'historical');
    expect(setCall).not.toHaveProperty('fact');
  });

  it('on conflict: returns rewrittenFact from Haiku', async () => {
    const existing = makeMemory({
      fact: 'Eleanor takes Tamoxifen 10mg daily',
    });
    generateTextMock.mockResolvedValueOnce({
      text: 'Eleanor was on Tamoxifen 10mg; now on Tamoxifen 20mg',
    });

    const result = await resolveConflicts(
      USER_A,
      'Eleanor takes Tamoxifen 20mg daily',
      'medication',
      [existing],
    );

    expect(result.superseded).toContain(existing.id);
    expect(result.rewrittenFact).toBe('Eleanor was on Tamoxifen 10mg; now on Tamoxifen 20mg');
  });

  it('no conflict → no Haiku call (cost guard)', async () => {
    const existing = makeMemory({
      category: 'medication',
      fact: 'Eleanor takes Metformin 500mg twice daily',
    });

    const result = await resolveConflicts(
      USER_A,
      'Eleanor saw Dr. Patel for follow-up appointment',
      'appointment',
      [existing],
    );

    expect(generateTextMock).not.toHaveBeenCalled();
    expect(result.superseded).toEqual([]);
    expect(result.rewrittenFact).toBeNull();
  });

  it('Haiku failure → still closes old row, returns rewrittenFact=null', async () => {
    const existing = makeMemory({
      fact: 'Eleanor takes Tamoxifen 10mg daily',
    });
    generateTextMock.mockRejectedValueOnce(new Error('Haiku timeout'));

    const result = await resolveConflicts(
      USER_A,
      'Eleanor takes Tamoxifen 20mg daily',
      'medication',
      [existing],
    );

    expect(dbMock.update).toHaveBeenCalled();
    expect(result.superseded).toContain(existing.id);
    expect(result.rewrittenFact).toBeNull();
  });

  it('duplicate → returns isDuplicate true, no row mutation, no Haiku call', async () => {
    const existing = makeMemory({
      fact: 'Eleanor takes Tamoxifen 10mg daily',
    });

    const result = await resolveConflicts(
      USER_A,
      'Eleanor takes Tamoxifen 10mg daily',
      'medication',
      [existing],
    );

    expect(result.isDuplicate).toBe(true);
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it('soft-deleted (validTo set) existing memory is skipped', async () => {
    const closed = makeMemory({
      fact: 'Eleanor takes Tamoxifen 10mg daily',
      validTo: new Date(),
    });

    const result = await resolveConflicts(
      USER_A,
      'Eleanor takes Tamoxifen 20mg daily',
      'medication',
      [closed],
    );

    expect(dbMock.update).not.toHaveBeenCalled();
    expect(result.superseded).toEqual([]);
    expect(generateTextMock).not.toHaveBeenCalled();
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
