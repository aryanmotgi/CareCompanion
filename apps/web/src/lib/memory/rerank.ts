export type RerankCandidate = { id: string; text: string };

const RERANK_TIMEOUT_MS = 600;

export async function rerank(
  query: string,
  candidates: RerankCandidate[],
  topK = 8,
): Promise<{ items: RerankCandidate[]; usedReranker: boolean }> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey || candidates.length === 0) {
    return { items: candidates.slice(0, topK), usedReranker: false };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RERANK_TIMEOUT_MS);
    const res = await fetch('https://api.voyageai.com/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'rerank-2.5-lite',
        query,
        documents: candidates.map((c) => c.text),
        top_k: topK,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn('[rerank] voyage non-2xx', res.status);
      return { items: candidates.slice(0, topK), usedReranker: false };
    }
    const data = (await res.json()) as {
      data: Array<{ index: number; relevance_score: number }>;
    };
    return {
      items: data.data.map((d) => candidates[d.index]).filter(Boolean),
      usedReranker: true,
    };
  } catch (e) {
    console.warn('[rerank] fallback to RRF order', (e as Error).message);
    return { items: candidates.slice(0, topK), usedReranker: false };
  }
}
