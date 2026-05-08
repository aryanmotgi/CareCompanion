/**
 * Memory conflict resolution.
 * When a user corrects a fact, the old memory should be superseded, not duplicated.
 */
import { db } from '@/lib/db'
import { memories } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { Memory } from './types'

type FactRelationship = 'conflict' | 'duplicate' | 'none'

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
