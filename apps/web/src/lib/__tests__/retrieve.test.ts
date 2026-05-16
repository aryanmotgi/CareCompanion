import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
    execute: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/lib/memory/embed', () => ({
  embedQuery: vi.fn(),
  toHalfvecLiteral: vi.fn((v: number[]) => `[${v.join(',')}]`),
}));

vi.mock('@/lib/memory/rerank', () => ({
  rerank: vi.fn(async () => ({ items: [], usedReranker: false })),
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

type ChainStub = Record<string, (...args: unknown[]) => unknown>;

function makeSelectChain(rows: unknown[]) {
  const chain: ChainStub = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(async () => rows);
  return chain;
}

import { embedQuery } from '@/lib/memory/embed';
import { rerank } from '@/lib/memory/rerank';
import { computeHybridScore, loadRelevantMemories, TIER1_CAP } from '@/lib/memory/retrieve';

const ORIGINAL_FLAG = process.env.ENABLE_MEMORY_HYBRID;
const USER_ID = '00000000-0000-0000-0000-000000000001';

describe('loadRelevantMemories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select.mockReset();
    dbMock.execute.mockReset();
    dbMock.insert.mockReset();
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => {
    if (ORIGINAL_FLAG === undefined) delete process.env.ENABLE_MEMORY_HYBRID;
    else process.env.ENABLE_MEMORY_HYBRID = ORIGINAL_FLAG;
  });

  it('feature flag OFF → legacy keyword path (no embed, no audit log)', async () => {
    delete process.env.ENABLE_MEMORY_HYBRID;
    dbMock.select.mockReturnValueOnce(makeSelectChain([]));
    await loadRelevantMemories(USER_ID, 'any medication?');
    expect(embedQuery).not.toHaveBeenCalled();
    expect(rerank).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('empty message → tier-1 only, audit reason chat_context_empty', async () => {
    process.env.ENABLE_MEMORY_HYBRID = 'true';
    const tier1 = [{ id: 't1', tier: 1, polarity: 'asserted', status: 'active' }];
    dbMock.select.mockReturnValueOnce(makeSelectChain(tier1));

    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    dbMock.insert.mockReturnValue({ values: valuesSpy });

    const out = await loadRelevantMemories(USER_ID, '');
    expect(out).toEqual(tier1);
    expect(embedQuery).not.toHaveBeenCalled();
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'chat_context_empty', memoryIds: ['t1'] }),
    );
  });

  it('whitespace-only message → tier-1 only', async () => {
    process.env.ENABLE_MEMORY_HYBRID = 'true';
    const tier1 = [{ id: 't1' }];
    dbMock.select.mockReturnValueOnce(makeSelectChain(tier1));
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const out = await loadRelevantMemories(USER_ID, '   \n  ');
    expect(out).toEqual(tier1);
    expect(embedQuery).not.toHaveBeenCalled();
  });

  it('audit log failure surfaces error (HIPAA fail-loud)', async () => {
    process.env.ENABLE_MEMORY_HYBRID = 'true';
    const tier1 = [{ id: 't1' }];
    dbMock.select.mockReturnValueOnce(makeSelectChain(tier1));
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('DB down')),
    });

    await expect(loadRelevantMemories(USER_ID, '')).rejects.toThrow('DB down');
  });

  it('hybrid path: vector + bm25 → rerank → tier-1 dedupe', async () => {
    process.env.ENABLE_MEMORY_HYBRID = 'true';

    const tier1 = [{ id: 'safety-1' }];
    dbMock.select.mockReturnValueOnce(makeSelectChain(tier1));

    (embedQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Array(768).fill(0),
    );

    dbMock.execute.mockResolvedValueOnce({
      rows: [
        { id: 'c1', fact: 'fact one' },
        { id: 'c2', fact: 'fact two' },
      ],
    });

    (rerank as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [
        { id: 'c2', text: 'fact two' },
        { id: 'c1', text: 'fact one' },
      ],
      usedReranker: true,
    });

    dbMock.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(async () => [
          { id: 'c1', fact: 'fact one' },
          { id: 'c2', fact: 'fact two' },
        ]),
      })),
    });

    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    dbMock.insert.mockReturnValue({ values: valuesSpy });

    const out = await loadRelevantMemories(USER_ID, 'tell me about my meds');

    expect(out.map((m) => m.id)).toEqual(['safety-1', 'c2', 'c1']);
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'chat_context' }),
    );
  });

  it('result capped at TIER1_CAP + limit (chunk-6: limit=15 → max 20)', async () => {
    process.env.ENABLE_MEMORY_HYBRID = 'true';

    const tier1Rows = Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, tier: 1 }));
    dbMock.select.mockReturnValueOnce(makeSelectChain(tier1Rows));

    (embedQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Array(768).fill(0));

    const extraRows = Array.from({ length: 25 }, (_, i) => ({ id: `e${i}`, fact: `fact ${i}` }));
    dbMock.execute.mockResolvedValueOnce({ rows: extraRows });

    (rerank as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: extraRows.map((r) => ({ id: r.id, text: r.fact })),
      usedReranker: true,
    });

    const fetchedExtras = Array.from({ length: 25 }, (_, i) => ({ id: `e${i}` }));
    dbMock.select.mockReturnValueOnce({
      from: vi.fn(() => ({ where: vi.fn(async () => fetchedExtras) })),
    });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const limit = 15;
    const out = await loadRelevantMemories(USER_ID, 'anything', limit, { hybrid: true });
    expect(out.length).toBeLessThanOrEqual(TIER1_CAP + limit);
  });

  it('hybrid path with reranker fallback → audit reason chat_context_no_rerank', async () => {
    process.env.ENABLE_MEMORY_HYBRID = 'true';

    dbMock.select.mockReturnValueOnce(makeSelectChain([]));
    (embedQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Array(768).fill(0),
    );
    dbMock.execute.mockResolvedValueOnce({ rows: [{ id: 'c1', fact: 'x' }] });
    (rerank as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [{ id: 'c1', text: 'x' }],
      usedReranker: false,
    });
    dbMock.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ id: 'c1' }]),
      })),
    });
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    dbMock.insert.mockReturnValue({ values: valuesSpy });

    await loadRelevantMemories(USER_ID, 'q');
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'chat_context_no_rerank' }),
    );
  });
});

// Chunk 5: seal importance + seen_count scoring behavior
describe('computeHybridScore', () => {
  const base = { vecScore: 0.5, kwScore: 0.5, recency: 0.5, importance: 0.5, seenCount: 1, trust: 0.5 };

  it('higher importance → higher score (all else equal)', () => {
    const low = computeHybridScore({ ...base, importance: 0.2 });
    const high = computeHybridScore({ ...base, importance: 0.9 });
    expect(high).toBeGreaterThan(low);
  });

  it('higher seen_count → higher score (all else equal)', () => {
    const low = computeHybridScore({ ...base, seenCount: 0 });
    const high = computeHybridScore({ ...base, seenCount: 20 });
    expect(high).toBeGreaterThan(low);
  });

  it('seen_count=0 → importance term is 0 (LN(1+0)=0)', () => {
    const withImportance = computeHybridScore({ vecScore: 0, kwScore: 0, recency: 0, importance: 1.0, seenCount: 0, trust: 0 });
    const withoutImportance = computeHybridScore({ vecScore: 0, kwScore: 0, recency: 0, importance: 0, seenCount: 0, trust: 0 });
    expect(withImportance).toBe(withoutImportance);
  });

  it('vec+kw weighted at 0.5 each', () => {
    const score = computeHybridScore({ vecScore: 1, kwScore: 1, recency: 0, importance: 0, seenCount: 0, trust: 0 });
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('trust weighted at 0.2', () => {
    const score = computeHybridScore({ vecScore: 0, kwScore: 0, recency: 0, importance: 0, seenCount: 0, trust: 1 });
    expect(score).toBeCloseTo(0.2, 5);
  });

  it('recency weighted at 0.2', () => {
    const score = computeHybridScore({ vecScore: 0, kwScore: 0, recency: 1, importance: 0, seenCount: 0, trust: 0 });
    expect(score).toBeCloseTo(0.2, 5);
  });

  it('importance * LN(1+seenCount) weighted at 0.1', () => {
    const score = computeHybridScore({ vecScore: 0, kwScore: 0, recency: 0, importance: 1, seenCount: Math.E - 1, trust: 0 });
    // importance=1, seenCount=e-1 → LN(1 + e-1) = LN(e) = 1 → term = 0.1 * 1 * 1 = 0.1
    expect(score).toBeCloseTo(0.1, 4);
  });
});

describe('TIER1_CAP', () => {
  it('is exactly 5 — change this constant deliberately, not accidentally', () => {
    expect(TIER1_CAP).toBe(5);
  });
});
