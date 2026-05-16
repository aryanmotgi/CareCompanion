/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadRelevantMemories } from '../src/lib/memory/retrieve';
import { EVAL_QUERIES, EVAL_USER_ID } from '../src/lib/__tests__/memory.eval';

const SNAP_DIR = path.join(process.cwd(), 'eval/snapshots');

async function main() {
  const labelArg = process.argv.find((a) => a.startsWith('--label='));
  const label = labelArg ? labelArg.split('=')[1] : 'run';
  const perQuery: any[] = [];

  for (const q of EVAL_QUERIES) {
    const start = Date.now();
    const mems = await loadRelevantMemories(EVAL_USER_ID, q.query, 8);
    const latencyMs = Date.now() - start;
    const retrievedSlugs = mems
      .map((m: any) => (m.slug as string | null) ?? (m.id as string));

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

  const recallScored = perQuery.filter((r) => r.recallAt8 !== null);
  const tier1Scored = perQuery.filter((r) => r.tier1Hit !== null);

  const avgRecall =
    recallScored.length === 0
      ? null
      : recallScored.reduce((s, r) => s + (r.recallAt8 as number), 0) / recallScored.length;
  const tier1Rate =
    tier1Scored.length === 0
      ? null
      : tier1Scored.filter((r) => r.tier1Hit).length / tier1Scored.length;

  const lats = perQuery.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p95 = lats[Math.max(0, Math.ceil(lats.length * 0.95) - 1)];

  const snapshot = {
    label,
    date: new Date().toISOString(),
    flagsHybrid: process.env.ENABLE_MEMORY_HYBRID === 'true',
    avgRecall,
    tier1Rate,
    latencyP95: p95,
    perQuery,
  };

  await fs.mkdir(SNAP_DIR, { recursive: true });
  const tsFile = path.join(SNAP_DIR, `${label}-${Date.now()}.json`);
  await fs.writeFile(tsFile, JSON.stringify(snapshot, null, 2));
  await fs.writeFile(path.join(SNAP_DIR, `${label}.json`), JSON.stringify(snapshot, null, 2));

  console.log(JSON.stringify({ label, avgRecall, tier1Rate, latencyP95: p95 }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
