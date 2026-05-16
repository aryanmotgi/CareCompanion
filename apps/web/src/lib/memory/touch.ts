import { db } from '@/lib/db';
import { memories } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import type { Memory } from './types';

const COMMON_WORDS = new Set([
  'what', 'when', 'how', 'the', 'is', 'are', 'my', 'your', 'about',
  'that', 'this', 'with', 'have', 'been', 'they', 'would', 'should',
  'could', 'will', 'just', 'from', 'want', 'need', 'and', 'for',
  'not', 'you', 'can', 'she', 'her', 'him', 'his', 'was', 'but',
  'all', 'any', 'one', 'had', 'also', 'more', 'who', 'which', 'their',
]);

function extractEntityTerms(text: string): Set<string> {
  const entities = new Set<string>();
  const medPattern = /\b([a-z]+)\s+\d+\s*mg\b/gi;
  const drPattern = /dr\.?\s+([a-z]+)/gi;
  let match;
  while ((match = medPattern.exec(text)) !== null) entities.add(match[1].toLowerCase());
  while ((match = drPattern.exec(text)) !== null) entities.add(match[1].toLowerCase());
  return entities;
}

/**
 * Touch memories relevant to the current message.
 * Requires 2+ keyword matches OR 1 exact entity match (medication name, doctor name).
 * Min keyword length 5 chars; common words excluded.
 */
export async function touchReferencedMemories(
  userId: string,
  userMessage: string,
  mems: Memory[],
): Promise<void> {
  const messageLower = userMessage.toLowerCase();

  const messageKeywords = messageLower
    .split(/\W+/)
    .filter((w) => w.length >= 5 && !COMMON_WORDS.has(w));

  const messageEntities = extractEntityTerms(messageLower);
  const referencedIds: string[] = [];

  for (const mem of mems) {
    const factLower = mem.fact.toLowerCase();
    const factKeywords = factLower
      .split(/\W+/)
      .filter((w) => w.length >= 5 && !COMMON_WORDS.has(w));

    const keywordMatches = messageKeywords.filter((kw) => factKeywords.includes(kw)).length;
    if (keywordMatches >= 2) {
      referencedIds.push(mem.id);
      continue;
    }

    const factEntities = extractEntityTerms(factLower);
    const hasEntityMatch = [...messageEntities].some((e) => factEntities.has(e));
    if (hasEntityMatch) {
      referencedIds.push(mem.id);
    }
  }

  if (referencedIds.length === 0) return;

  // Note: userId currently unused in scope filter — referencedIds are derived from `mems`
  // which were already loaded for `userId`. Kept in signature for API parity + future
  // safety scoping if callers ever pass cross-user memory lists.
  void userId;

  await db
    .update(memories)
    .set({ lastReferenced: new Date() })
    .where(inArray(memories.id, referencedIds));
}
