/**
 * Memory conflict resolution.
 * When a user corrects a fact, the old memory should be superseded, not duplicated.
 * When a user corrects a fact, the old memory should be superseded, not duplicated.
 */
import { db } from '@/lib/db'
import { memories } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { Memory } from './types'

/**
 * Find and supersede conflicting memories when a correction is detected.
 * Returns the IDs of superseded memories.
 */
export async function resolveConflicts(
  userId: string,
  newFact: string,
  category: string,
  existingMemories: Memory[],
): Promise<string[]> {
  const superseded: string[] = []

  // Find memories in the same category that might conflict
  const sameCategoryMemories = existingMemories.filter(m => m.category === category)

  for (const mem of sameCategoryMemories) {
    if (isConflicting(mem.fact, newFact)) {
      superseded.push(mem.id)

      // Mark the old memory as superseded
      await db
        .update(memories)
        .set({
          confidence: 'low',
          fact: `[SUPERSEDED by: "${newFact.slice(0, 100)}"] ${mem.fact}`,
        })
        .where(eq(memories.id, mem.id))
    }
  }

  return superseded
}

/**
 * Simple heuristic to detect conflicting facts.
 * Two facts conflict if they reference the same entity but with different values.
 */
function isConflicting(existingFact: string, newFact: string): boolean {
  const existingLower = existingFact.toLowerCase()
  const newLower = newFact.toLowerCase()

  // Already superseded
  if (existingLower.startsWith('[superseded')) return false

  // Extract subject entities (medication names, doctor names, etc.)
  const existingEntities = extractEntities(existingLower)
  const newEntities = extractEntities(newLower)

  // If they share an entity reference, they might conflict
  const sharedEntities = existingEntities.filter(e => newEntities.includes(e))
  if (sharedEntities.length === 0) return false

  // If the facts are similar enough in subject but different in detail, they conflict
  // E.g., "Takes Lisinopril 10mg daily" vs "Takes Lisinopril 20mg daily"
  const existingWords = new Set(existingLower.split(/\s+/))
  const newWords = new Set(newLower.split(/\s+/))

  // Calculate overlap
  let overlap = 0
  for (const word of Array.from(existingWords)) {
    if (newWords.has(word)) overlap++
  }

  const overlapRatio = overlap / Math.max(existingWords.size, newWords.size)

  // High overlap (>50%) with shared entities = likely a correction/update
  return overlapRatio > 0.5 && overlapRatio < 0.95 // Not identical, but about the same thing
}

/**
 * Extract entity-like terms from a fact string.
 * Looks for capitalized words, medication names, numbers with units.
 */
function extractEntities(text: string): string[] {
  const entities: string[] = []

  // Common medication patterns (word followed by dosage)
  const medPattern = /\b([a-z]+)\s+\d+\s*mg\b/gi
  let match
  while ((match = medPattern.exec(text)) !== null) {
    entities.push(match[1].toLowerCase())
  }

  // Doctor names (Dr. or doctor)
  const drPattern = /dr\.?\s+([a-z]+)/gi
  while ((match = drPattern.exec(text)) !== null) {
    entities.push(match[1].toLowerCase())
  }

  // Allergy mentions
  const allergyPattern = /allerg(?:y|ic)\s+(?:to\s+)?([a-z]+)/gi
  while ((match = allergyPattern.exec(text)) !== null) {
    entities.push(match[1].toLowerCase())
  }

  return entities
}

