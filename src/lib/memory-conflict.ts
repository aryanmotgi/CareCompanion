/**
 * Memory conflict resolution.
 * When a user corrects a fact, the old memory should be superseded, not duplicated.
 * Also handles confidence decay for old unreferenced memories.
 */
import { createAdminClient } from '@/lib/supabase/admin'
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
  const admin = createAdminClient()
  const superseded: string[] = []

  // Find memories in the same category that might conflict
  const sameCategoryMemories = existingMemories.filter(m => m.category === category)

  for (const mem of sameCategoryMemories) {
    if (isConflicting(mem.fact, newFact)) {
      superseded.push(mem.id)

      // Mark the old memory as superseded
      await admin.from('memories').update({
        confidence: 'low',
        fact: `[SUPERSEDED by: "${newFact.slice(0, 100)}"] ${mem.fact}`,
      }).eq('id', mem.id)
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

/**
 * Apply confidence decay to old unreferenced memories.
 * Memories not referenced in 90+ days get downgraded.
 * Run from a cron job.
 */
export async function decayOldMemories(): Promise<number> {
  const admin = createAdminClient()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Downgrade high → medium for memories not referenced in 90 days
  const { data: decayed } = await admin
    .from('memories')
    .update({ confidence: 'medium' })
    .eq('confidence', 'high')
    .lt('last_referenced', ninetyDaysAgo)
    .not('fact', 'ilike', '%[SUPERSEDED%')
    .select('id')

  // Downgrade medium → low for memories not referenced in 180 days
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
  const { data: furtherDecayed } = await admin
    .from('memories')
    .update({ confidence: 'low' })
    .eq('confidence', 'medium')
    .lt('last_referenced', sixMonthsAgo)
    .not('fact', 'ilike', '%[SUPERSEDED%')
    .select('id')

  return (decayed?.length || 0) + (furtherDecayed?.length || 0)
}
