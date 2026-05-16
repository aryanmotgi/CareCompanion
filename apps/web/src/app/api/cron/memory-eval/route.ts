/**
 * Daily eval cron: runs retrieval eval against fixture user, detects recall drift.
 * Alert fires if avgRecall drops ≥ 5pt below EVAL_BASELINE_RECALL env var.
 * Requires eval fixtures seeded for EVAL_USER_ID in Aurora.
 *
 * Chunk 10 (v2.1): tier1Rate_hybrid vs tier1Rate_simple split + drift alert.
 * cacheHitRate: stubbed null — wire when Anthropic cache metrics available.
 */
import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { loadRelevantMemories } from '@/lib/memory/retrieve';
import { EVAL_QUERIES, EVAL_USER_ID } from '@/lib/__tests__/memory.eval';

const TIER1_CAP = 5;
const DRIFT_THRESHOLD = 0.05; // 5 percentage points

async function runPath(limit: number, hybrid: boolean) {
  const perQuery: Array<{
    id: string;
    recallAt8: number | null;
    tier1Hit: boolean | null;
    totalResults: number;
    assertionOk: boolean;
  }> = [];

  for (const q of EVAL_QUERIES) {
    const mems = await loadRelevantMemories(EVAL_USER_ID, q.query, limit, { hybrid });
    const slugs = mems.map((m) => (m.slug ?? m.id));

    const recallAt8 =
      q.expected.length > 0
        ? q.expected.filter((s) => slugs.includes(s)).length / q.expected.length
        : null;
    const tier1Hit =
      q.mustTier1.length > 0 ? q.mustTier1.every((s) => slugs.includes(s)) : null;

    perQuery.push({
      id: q.id,
      recallAt8,
      tier1Hit,
      totalResults: mems.length,
      assertionOk: mems.length <= TIER1_CAP + limit,
    });
  }

  const recallScored = perQuery.filter((r) => r.recallAt8 !== null);
  const tier1Scored = perQuery.filter((r) => r.tier1Hit !== null);

  return {
    avgRecall:
      recallScored.length === 0
        ? null
        : recallScored.reduce((s, r) => s + (r.recallAt8 ?? 0), 0) / recallScored.length,
    tier1Rate:
      tier1Scored.length === 0
        ? null
        : tier1Scored.filter((r) => r.tier1Hit).length / tier1Scored.length,
    assertionFailures: perQuery.filter((r) => !r.assertionOk).length,
    perQuery,
  };
}

export async function GET(req: Request) {
  const authError = verifyCronRequest(req);
  if (authError) return authError;

  try {
    const [hybrid, simple] = await Promise.all([
      runPath(8, true),
      runPath(8, false),
    ]);

    const baseline = process.env.EVAL_BASELINE_RECALL
      ? parseFloat(process.env.EVAL_BASELINE_RECALL)
      : null;

    const driftAlert =
      baseline !== null && hybrid.avgRecall !== null && hybrid.avgRecall < baseline - DRIFT_THRESHOLD
        ? { detected: true, baseline, current: hybrid.avgRecall, delta: hybrid.avgRecall - baseline }
        : null;

    if (driftAlert) {
      console.error('[cron/memory-eval] DRIFT ALERT', driftAlert);
    }

    if (hybrid.assertionFailures > 0) {
      console.error('[cron/memory-eval] TIER1_CAP+limit assertion failures', hybrid.assertionFailures);
    }

    return NextResponse.json({
      ok: true,
      avgRecall: hybrid.avgRecall,
      tier1Rate_hybrid: hybrid.tier1Rate,
      tier1Rate_simple: simple.tier1Rate,
      cacheHitRate: null, // TODO: wire when Anthropic cache metrics available
      driftAlert,
      assertionFailures: hybrid.assertionFailures,
      queriesRun: EVAL_QUERIES.length,
    });
  } catch (error) {
    console.error('[cron/memory-eval] failed:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'eval_failed' }, { status: 500 });
  }
}
