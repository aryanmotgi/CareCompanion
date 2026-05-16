/**
 * Memory conflict resolution.
 * When a user corrects a fact, the old memory should be superseded, not duplicated.
 */
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
    WHERE user_id = ${userId}
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
 * Returns superseded IDs and whether the new fact is a duplicate (skip insertion).
 */
export async function resolveConflicts(
  userId: string,
  newFact: string,
  category: string,
  existingMemories: Memory[],
): Promise<{ superseded: string[]; isDuplicate: boolean }> {
  const superseded: string[] = []

  const sameCategoryMemories = existingMemories.filter(m => m.category === category)

  for (const mem of sameCategoryMemories) {
    const result = classifyFactRelationship(mem.fact, newFact)

    if (result === 'duplicate') {
      return { superseded, isDuplicate: true }
    }

    if (result === 'conflict') {
      superseded.push(mem.id)
      await db
        .update(memories)
        .set({
          confidence: 'low',
          fact: `[SUPERSEDED by: "${newFact.slice(0, 100)}"] ${mem.fact}`,
        })
        .where(eq(memories.id, mem.id))
    }
  }

  return { superseded, isDuplicate: false }
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
