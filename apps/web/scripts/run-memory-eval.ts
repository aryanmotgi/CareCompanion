/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadRelevantMemories } from '../src/lib/memory/retrieve';
import { EVAL_QUERIES, EVAL_USER_ID } from '../src/lib/__tests__/memory.eval';

const SNAP_DIR = path.join(process.cwd(), 'eval/snapshots');
const TIER1_CAP = 5; // mirrored from retrieve.ts

async function runQueries(limit: number, hybrid: boolean): Promise<any[]> {
  const perQuery: any[] = [];

  for (const q of EVAL_QUERIES) {
    const start = Date.now();
    const mems = await loadRelevantMemories(EVAL_USER_ID, q.query, limit, { hybrid });
    const latencyMs = Date.now() - start;
    const retrievedSlugs = mems.map((m: any) => (m.slug as string | null) ?? (m.id as string));

    // Chunk 6: enforce TIER1_CAP + limit contract
    const maxAllowed = TIER1_CAP + limit;
    if (retrievedSlugs.length > maxAllowed) {
      console.error(`[eval] ASSERTION FAILED: got ${retrievedSlugs.length} results for limit=${limit} (max allowed ${maxAllowed})`);
    }

    const recallAt8 =
      q.expected.length > 0
        ? q.expected.filter((s) => retrievedSlugs.includes(s)).length / q.expected.length
        : null;

    const tier1Hit =
      q.mustTier1.length > 0
        ? q.mustTier1.every((s) => retrievedSlugs.includes(s))
        : null;

    perQuery.push({ ...q, retrievedSlugs, recallAt8, tier1Hit, latencyMs });
  }

  return perQuery;
}

function computeMetrics(perQuery: any[]) {
  const recallScored = perQuery.filter((r) => r.recallAt8 !== null);
  const tier1Scored = perQuery.filter((r) => r.tier1Hit !== null);

  const avgRecall =
    recallScored.length === 0
      ? null
      : recallScored.reduce((s: number, r: any) => s + (r.recallAt8 as number), 0) / recallScored.length;

  const tier1Rate =
    tier1Scored.length === 0
      ? null
      : tier1Scored.filter((r: any) => r.tier1Hit).length / tier1Scored.length;

  const lats = perQuery.map((r: any) => r.latencyMs as number).sort((a: number, b: number) => a - b);
  const p95 = lats[Math.max(0, Math.ceil(lats.length * 0.95) - 1)];

  return { avgRecall, tier1Rate, latencyP95: p95 };
}

async function main() {
  const labelArg = process.argv.find((a) => a.startsWith('--label='));
  const label = labelArg ? labelArg.split('=')[1] : 'run';

  // Chunk 10: run both hybrid and simple paths for tier1Rate split
  const hybridEnabled = process.env.ENABLE_MEMORY_HYBRID === 'true';

  // limit=8 (original) + limit=15 (chunk-6: exercises TIER1_CAP+limit=13/20 contract)
  const [perQuery8Hybrid, perQuery15Hybrid, perQuery8Simple] = await Promise.all([
    runQueries(8, true),
    runQueries(15, true),
    runQueries(8, false),
  ]);

  const metrics8Hybrid = computeMetrics(perQuery8Hybrid);
  const metrics15Hybrid = computeMetrics(perQuery15Hybrid);
  const metrics8Simple = computeMetrics(perQuery8Simple);

  const snapshot = {
    label,
    date: new Date().toISOString(),
    flagsHybrid: hybridEnabled,
    // Legacy top-level for backwards compat
    avgRecall: metrics8Hybrid.avgRecall,
    tier1Rate: metrics8Hybrid.tier1Rate,
    latencyP95: metrics8Hybrid.latencyP95,
    // Chunk 10: split by path
    tier1Rate_hybrid: metrics8Hybrid.tier1Rate,
    tier1Rate_simple: metrics8Simple.tier1Rate,
    // Chunk 10: cache hit rate stub — wire when Anthropic cache metrics available
    cacheHitRate: null as null,
    // Chunk 6: limit=15 run to exercise TIER1_CAP+limit=20 contract
    limit15: {
      avgRecall: metrics15Hybrid.avgRecall,
      tier1Rate: metrics15Hybrid.tier1Rate,
      latencyP95: metrics15Hybrid.latencyP95,
    },
    perQuery: perQuery8Hybrid,
  };

  await fs.mkdir(SNAP_DIR, { recursive: true });
  const tsFile = path.join(SNAP_DIR, `${label}-${Date.now()}.json`);
  await fs.writeFile(tsFile, JSON.stringify(snapshot, null, 2));
  await fs.writeFile(path.join(SNAP_DIR, `${label}.json`), JSON.stringify(snapshot, null, 2));

  console.log(JSON.stringify({
    label,
    avgRecall: metrics8Hybrid.avgRecall,
    tier1Rate_hybrid: metrics8Hybrid.tier1Rate,
    tier1Rate_simple: metrics8Simple.tier1Rate,
    limit15_avgRecall: metrics15Hybrid.avgRecall,
    latencyP95: metrics8Hybrid.latencyP95,
    cacheHitRate: null,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
