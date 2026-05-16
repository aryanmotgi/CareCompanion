/**
 * Non-destructive polarity correction for legacy safety-critical memories.
 *
 * Only acts on rows where polarity='asserted' AND category in
 * (allergy, condition, medication) AND fact contains negation cues. The fact
 * text is NEVER mutated — only the `polarity` column flips to 'negated'.
 * Each flip is written to `memory_access_log` for HIPAA traceability.
 *
 * Idempotent: subsequent runs see polarity='negated' and skip.
 *
 * Usage:
 *   bun apps/web/scripts/repolarize-legacy-memories.ts [--dry-run]
 *
 * Requires ANTHROPIC_API_KEY plus Aurora Data API env vars.
 */
import { sql } from 'drizzle-orm'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { db } from '../src/lib/db'

const NEGATION_HINTS = /\b(no |not |never |denies |denied |ruled out|negative for|absent|without|free of)\b/i
const SAFETY_CATS = ['allergy', 'condition', 'medication']

type Row = { id: string; fact: string; category: string }

function unwrap<T = unknown>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  return ((result as { rows?: unknown[] }).rows ?? []) as T[]
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const candidates = unwrap<Row>(
    await db.execute(sql`
      SELECT id, fact, category FROM memories
      WHERE category IN ('allergy', 'condition', 'medication')
        AND polarity = 'asserted'
    `),
  )
  const suspects = candidates.filter((c) => NEGATION_HINTS.test(c.fact))
  console.log(`${suspects.length} suspect rows of ${candidates.length} safety-critical`)

  let flipped = 0
  for (const s of suspects) {
    const { output } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      output: Output.object({
        schema: z.object({ polarity: z.enum(['asserted', 'negated']) }),
      }),
      prompt: `Determine if this medical fact is asserted (true) or negated (denied/ruled out). Output polarity only.\n\nFACT: ${s.fact}`,
    })
    if (output.polarity === 'negated') {
      flipped += 1
      console.log(`FLIP: ${s.id} -> negated: ${s.fact.slice(0, 80)}`)
      if (!dryRun) {
        await db.execute(sql`UPDATE memories SET polarity = 'negated' WHERE id = ${s.id}::uuid`)
        await db.execute(sql`
          INSERT INTO memory_access_log (user_id, memory_ids, reason)
          SELECT user_id, ARRAY[id], 'polarity_correction'
          FROM memories WHERE id = ${s.id}::uuid
        `)
      }
    }
  }
  console.log(`Done. ${flipped} rows flipped${dryRun ? ' (dry-run)' : ''}.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
