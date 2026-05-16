/**
 * Backfill embeddings for memories rows where `embedding IS NULL`.
 * Idempotent. Re-runs continue with rows still NULL.
 *
 * Usage:
 *   bun apps/web/scripts/backfill-embeddings.ts [--dry-run] [--limit=N]
 *
 * Requires GEMINI_API_KEY, plus Aurora Data API env vars
 * (AWS_REGION, AWS_RESOURCE_ARN, AWS_SECRET_ARN, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
 */
import { sql } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { embedTextBatch, toHalfvecLiteral } from '../src/lib/memory/embed'

const BATCH_SIZE = 20
const SLEEP_MS = 1500

type Row = { id: string; fact: string }

function unwrap<T = unknown>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  return ((result as { rows?: unknown[] }).rows ?? []) as T[]
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1]
  const limit = limitArg ? parseInt(limitArg, 10) : 10_000

  if (dryRun) {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM memories WHERE embedding IS NULL
    `)
    const n = unwrap<{ n: number | string }>(result)[0]?.n ?? 0
    console.log(`Dry-run: ${n} memories need embeddings (would process up to ${limit}).`)
    return
  }

  let total = 0
  let batchNo = 0
  while (total < limit) {
    const remaining = limit - total
    const take = Math.min(BATCH_SIZE, remaining)
    const result = await db.execute(sql`
      SELECT id, fact FROM memories WHERE embedding IS NULL LIMIT ${take}
    `)
    const rows = unwrap<Row>(result)
    if (rows.length === 0) break

    batchNo += 1
    console.log(`Batch ${batchNo}: embedding ${rows.length} rows`)

    const embeds = await embedTextBatch(rows.map((r) => r.fact))
    await db.transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const lit = toHalfvecLiteral(embeds[i])
        await tx.execute(sql`
          UPDATE memories SET embedding = ${lit}::halfvec
          WHERE id = ${rows[i].id}::uuid
        `)
      }
    })

    total += rows.length
    await new Promise((r) => setTimeout(r, SLEEP_MS))
  }
  console.log(`Done. Embedded ${total} memories.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
