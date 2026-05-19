/**
 * Memory conflict resolution.
 * When a user corrects a fact, the old memory should be superseded, not duplicated.
 */
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { db } from '@/lib/db'
import { memories } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import type { Memory } from './types'

type FactRelationship = 'conflict' | 'duplicate' | 'none'

const COSINE_DUP_THRESHOLD = 0.88

/**
 * Cosine-similarity dedup. Returns the id of the nearest existing memory for
 * the same (user_id, category) when cosine similarity > 0.88; otherwise null.
 *
 * Strict `>` at threshold so an exact tie does not collapse a borderline fact
 * into an existing row. Mandatory user-id + category scoping prevents
 * cross-patient and cross-category collisions.
 */
export async function findCosineDuplicate(
  userId: string,
  category: string,
  embeddingLit: string,
): Promise<{ duplicateId: string | null }> {
  if (!embeddingLit) return { duplicateId: null }

  const result = await db.execute(sql`
    SELECT id, 1 - (embedding <=> ${embeddingLit}::halfvec) AS similarity
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND category = ${category}
      AND valid_to IS NULL
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingLit}::halfvec
    LIMIT 1
  `)

  const rows = (result as unknown as { rows: Array<{ id: string; similarity: number }> }).rows
  if (rows.length === 0) return { duplicateId: null }

  const top = rows[0]
  if (Number(top.similarity) > COSINE_DUP_THRESHOLD) {
    return { duplicateId: top.id }
  }
  return { duplicateId: null }
}

/**
 * Bump `seen_count` and refresh `last_referenced` on an existing memory.
 * Called when a cosine-duplicate is detected on the write path so retrieval
 * ranking naturally surfaces repeatedly-mentioned facts.
 */
export async function bumpSeenCount(memoryId: string): Promise<void> {
  await db.execute(sql`
    UPDATE memories
    SET seen_count = seen_count + 1,
        last_referenced = NOW()
    WHERE id = ${memoryId}
  `)
}

/**
 * Find and supersede conflicting memories when a correction is detected.
 *
 * Non-destructive: the old row's `fact` column is NEVER mutated. The old row
 * is closed via `valid_to = NOW()` + `status = 'historical'`, which makes it
 * invisible to retrieval (which filters `valid_to IS NULL`) while preserving
 * the original wording for audit.
 *
 * When a conflict is detected the function asks Haiku to rewrite the pair
 * into a single time-aware narrative (e.g. "Eleanor was on Tamoxifen 10mg
 * until April; now on Tamoxifen 20mg"). The caller should insert this
 * rewritten narrative in place of the raw new fact. If Haiku fails the
 * rewrittenFact is null and the caller falls back to the raw new fact.
 *
 * Soft-deleted existing memories (validTo set) are skipped — they are
 * already closed and should not generate fresh contradictions.
 */
export async function resolveConflicts(
  userId: string,
  newFact: string,
  category: string,
  existingMemories: Memory[],
): Promise<{ superseded: string[]; isDuplicate: boolean; rewrittenFact: string | null }> {
  const superseded: string[] = []
  let rewrittenFact: string | null = null

  const sameCategoryMemories = existingMemories.filter(
    (m) => m.category === category && !m.validTo,
  )

  for (const mem of sameCategoryMemories) {
    const result = classifyFactRelationship(mem.fact, newFact)

    if (result === 'duplicate') {
      return { superseded, isDuplicate: true, rewrittenFact: null }
    }

    if (result === 'conflict') {
      superseded.push(mem.id)
      await db
        .update(memories)
        .set({
          validTo: new Date(),
          status: 'historical',
        })
        .where(eq(memories.id, mem.id))

      if (rewrittenFact === null) {
        rewrittenFact = await rewriteContradictionViaHaiku(mem.fact, newFact)
      }
    }
  }

  return { superseded, isDuplicate: false, rewrittenFact }
}

/**
 * Merge two contradicting facts into one time-aware narrative via Haiku.
 * Returns null on any failure so the caller falls back to the raw new fact.
 */
async function rewriteContradictionViaHaiku(oldFact: string, newFact: string): Promise<string | null> {
  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt: `You are rewriting two contradicting medical facts into a single time-aware narrative for a caregiver AI's long-term memory.

OLD FACT (now historical): ${oldFact}
NEW FACT (now current): ${newFact}

Write ONE sentence that:
- States the new fact as current
- Notes the prior state in parenthetical or "was X until Y" form
- Uses specific values (medication doses, dates) when present
- Stays under 30 words
- Contains no preface, no quotes, no markdown

Output only the sentence.`,
    })
    const trimmed = (text ?? '').trim()
    return trimmed.length > 0 ? trimmed : null
  } catch (err) {
    console.error('[memory-conflict] rewrite via Haiku failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}

function classifyFactRelationship(existingFact: string, newFact: string): FactRelationship {
  const existingLower = existingFact.toLowerCase()
  const newLower = newFact.toLowerCase()

  if (existingLower.startsWith('[superseded')) return 'none'

  // Too short to reliably detect conflicts
  if (newFact.trim().split(/\s+/).length < 5) return 'none'

  const existingEntities = extractEntities(existingLower)
  const newEntities = extractEntities(newLower)

  // Must share at least 1 named entity (medication, doctor, allergy term)
  const sharedEntities = existingEntities.filter(e => newEntities.includes(e))
  if (sharedEntities.length === 0) return 'none'

  const existingWords = new Set(existingLower.split(/\s+/))
  const newWords = new Set(newLower.split(/\s+/))

  let overlap = 0
  for (const word of Array.from(existingWords)) {
    if (newWords.has(word)) overlap++
  }

  const overlapRatio = overlap / Math.max(existingWords.size, newWords.size)

  if (overlapRatio >= 0.95) return 'duplicate'
  if (overlapRatio >= 0.65) return 'conflict'
  return 'none'
}

/**
 * Extract named entity terms from a fact string.
 * Looks for medication names, doctor names, and allergy targets.
 */
function extractEntities(text: string): string[] {
  const entities: string[] = []

  const medPattern = /\b([a-z]+)\s+\d+\s*mg\b/gi
  let match
  while ((match = medPattern.exec(text)) !== null) {
    entities.push(match[1].toLowerCase())
  }

  const drPattern = /dr\.?\s+([a-z]+)/gi
  while ((match = drPattern.exec(text)) !== null) {
    entities.push(match[1].toLowerCase())
  }

  const allergyPattern = /allerg(?:y|ic)\s+(?:to\s+)?([a-z]+)/gi
  while ((match = allergyPattern.exec(text)) !== null) {
    entities.push(match[1].toLowerCase())
  }

  return entities
}
