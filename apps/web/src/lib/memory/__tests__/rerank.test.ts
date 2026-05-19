import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rerank } from '@/lib/memory/rerank';

const CANDIDATES = [
  { id: 'a', text: 'Patient takes metformin 1000mg daily' },
  { id: 'b', text: 'CEA was 28 after cycle 2' },
  { id: 'c', text: 'Dr. Smith ordered a CT scan next week' },
];

describe('rerank', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('fallback paths (usedReranker=false)', () => {
    it('falls back when VOYAGE_API_KEY is not set', async () => {
      const { items, usedReranker } = await rerank('medications', CANDIDATES, 2);
      expect(usedReranker).toBe(false);
      expect(items).toEqual(CANDIDATES.slice(0, 2));
      expect(fetch).not.toHaveBeenCalled();
    });

    it('falls back when candidates is empty (no fetch call)', async () => {
      vi.stubEnv('VOYAGE_API_KEY', 'vk-test-key');
      const { items, usedReranker } = await rerank('medications', [], 3);
      expect(usedReranker).toBe(false);
      expect(items).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('falls back on HTTP non-2xx response', async () => {
      vi.stubEnv('VOYAGE_API_KEY', 'vk-test-key');
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
      } as Response);

      const { items, usedReranker } = await rerank('medications', CANDIDATES, 2);
      expect(usedReranker).toBe(false);
      expect(items).toEqual(CANDIDATES.slice(0, 2));
    });

    it('falls back on network error', async () => {
      vi.stubEnv('VOYAGE_API_KEY', 'vk-test-key');
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const { items, usedReranker } = await rerank('medications', CANDIDATES, 2);
      expect(usedReranker).toBe(false);
      expect(items).toEqual(CANDIDATES.slice(0, 2));
    });

    it('falls back on AbortError (timeout)', async () => {
      vi.stubEnv('VOYAGE_API_KEY', 'vk-test-key');
      const abortErr = Object.assign(new Error('signal aborted'), { name: 'AbortError' });
      vi.mocked(fetch).mockRejectedValueOnce(abortErr);

      const { items, usedReranker } = await rerank('medications', CANDIDATES, 2);
      expect(usedReranker).toBe(false);
      expect(items).toEqual(CANDIDATES.slice(0, 2));
    });
  });

  describe('successful rerank', () => {
    it('returns reranked candidates in Voyage score order', async () => {
      vi.stubEnv('VOYAGE_API_KEY', 'vk-test-key');
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { index: 2, relevance_score: 0.97 },
            { index: 0, relevance_score: 0.88 },
          ],
        }),
      } as Response);

      const { items, usedReranker } = await rerank('CT scan', CANDIDATES, 2);
      expect(usedReranker).toBe(true);
      expect(items).toHaveLength(2);
      expect(items[0].id).toBe('c'); // index 2 → highest score
      expect(items[1].id).toBe('a'); // index 0
    });

    it('respects topK parameter', async () => {
      vi.stubEnv('VOYAGE_API_KEY', 'vk-test-key');
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { index: 1, relevance_score: 0.91 },
          ],
        }),
      } as Response);

      const { items, usedReranker } = await rerank('labs', CANDIDATES, 1);
      expect(usedReranker).toBe(true);
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('b');
    });

    it('sends correct Authorization header and model to Voyage API', async () => {
      vi.stubEnv('VOYAGE_API_KEY', 'vk-test-key');
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ index: 0, relevance_score: 1.0 }] }),
      } as Response);

      await rerank('labs', CANDIDATES, 1);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.voyageai.com/v1/rerank',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer vk-test-key',
            'Content-Type': 'application/json',
          }),
        }),
      );

      const [, init] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.model).toBe('rerank-2.5-lite');
      expect(body.top_k).toBe(1);
      expect(body.query).toBe('labs');
      expect(body.documents).toEqual(CANDIDATES.map((c) => c.text));
    });
  });

  describe('edge cases', () => {
    it('single candidate, no API key → returns it', async () => {
      const single = [{ id: 'x', text: 'only one' }];
      const { items, usedReranker } = await rerank('query', single, 8);
      expect(usedReranker).toBe(false);
      expect(items).toEqual(single);
    });

    it('topK larger than candidates → returns all candidates (no key)', async () => {
      const { items } = await rerank('q', CANDIDATES, 100);
      expect(items).toEqual(CANDIDATES);
    });
  });
});
