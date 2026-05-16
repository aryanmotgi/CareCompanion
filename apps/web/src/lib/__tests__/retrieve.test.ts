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
import { loadRelevantMemories } from '@/lib/memory/retrieve';

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
