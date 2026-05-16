import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rerank } from '@/lib/memory/rerank';

const ORIGINAL_KEY = process.env.VOYAGE_API_KEY;

describe('rerank', () => {
  beforeEach(() => {
    process.env.VOYAGE_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env.VOYAGE_API_KEY = ORIGINAL_KEY;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('no API key → fallback, usedReranker=false', async () => {
    delete process.env.VOYAGE_API_KEY;
    const out = await rerank('q', [
      { id: '1', text: 'a' },
      { id: '2', text: 'b' },
    ], 1);
    expect(out.usedReranker).toBe(false);
    expect(out.items.map((i) => i.id)).toEqual(['1']);
  });

  it('empty candidates → no fetch, usedReranker=false', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const out = await rerank('q', [], 5);
    expect(out.usedReranker).toBe(false);
    expect(out.items).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('voyage non-2xx → fallback to original order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('err', { status: 500 })));
    const out = await rerank('q', [
      { id: '1', text: 'a' },
      { id: '2', text: 'b' },
    ], 2);
    expect(out.usedReranker).toBe(false);
    expect(out.items.map((i) => i.id)).toEqual(['1', '2']);
  });

  it('fetch throws → fallback to original order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const out = await rerank('q', [
      { id: '1', text: 'a' },
      { id: '2', text: 'b' },
    ], 1);
    expect(out.usedReranker).toBe(false);
    expect(out.items.map((i) => i.id)).toEqual(['1']);
  });

  it('voyage 200 → returns reranked order, usedReranker=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { index: 1, relevance_score: 0.9 },
            { index: 0, relevance_score: 0.5 },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const out = await rerank('q', [
      { id: 'a', text: 'alpha' },
      { id: 'b', text: 'bravo' },
    ], 2);

    expect(out.usedReranker).toBe(true);
    expect(out.items.map((i) => i.id)).toEqual(['b', 'a']);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('rerank-2.5-lite');
    expect(body.top_k).toBe(2);
    expect(body.documents).toEqual(['alpha', 'bravo']);
  });
});
