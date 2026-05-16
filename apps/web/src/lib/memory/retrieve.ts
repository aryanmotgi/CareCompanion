import { db } from '@/lib/db';
import { memories, conversationSummaries, memoryAccessLog } from '@/lib/db/schema';
import { eq, desc, inArray, and, or, gt, isNull, sql } from 'drizzle-orm';
import { embedQuery, toHalfvecLiteral } from './embed';
import { rerank } from './rerank';
import type { Memory, ConversationSummary } from './types';

const TIER1_CAP = 5;

// RDS Data API cannot serialize halfvec/tsvector result columns. Select an
// explicit projection that excludes `embedding` and `fact_tsv`.
const MEMORY_COLS = {
  id: memories.id,
  userId: memories.userId,
  careProfileId: memories.careProfileId,
  category: memories.category,
  fact: memories.fact,
  source: memories.source,
  confidence: memories.confidence,
  createdAt: memories.createdAt,
  lastReferenced: memories.lastReferenced,
  validFrom: memories.validFrom,
  validTo: memories.validTo,
  polarity: memories.polarity,
  status: memories.status,
  subject: memories.subject,
  importance: memories.importance,
  seenCount: memories.seenCount,
  tier: memories.tier,
  trust: memories.trust,
  decayAt: memories.decayAt,
  cycleNumber: memories.cycleNumber,
  labValueNumeric: memories.labValueNumeric,
  labValueUnit: memories.labValueUnit,
  measuredAt: memories.measuredAt,
  severity: memories.severity,
  slug: memories.slug,
} as const;

const CATEGORY_SIGNALS: Record<string, string[]> = {
  medication: ['medication', 'medicine', 'drug', 'pill', 'dose', 'dosage', 'mg', 'prescription', 'pharmacy', 'tablet', 'capsule'],
  insurance: ['insurance', 'claim', 'coverage', 'copay', 'deductible', 'premium', 'benefit', 'authorization', 'denial'],
  appointment: ['appointment', 'schedule', 'visit', 'clinic', 'hospital', 'referral'],
  lab_result: ['lab', 'result', 'blood', 'levels', 'reading', 'glucose', 'pressure', 'cholesterol'],
  financial: ['cost', 'pay', 'bill', 'payment', 'afford', 'expense', 'financial', 'money'],
  provider: ['doctor', 'physician', 'specialist', 'nurse', 'therapist'],
  family: ['family', 'caregiver', 'mom', 'dad', 'parent', 'child', 'sibling', 'spouse'],
  preference: ['prefer', 'like', 'dislike'],
  lifestyle: ['diet', 'exercise', 'sleep', 'smoking', 'alcohol', 'weight'],
  emotional_state: ['exhausted', 'scared', 'hopeful', 'anxious', 'depressed', 'overwhelmed', 'stressed', 'worried', 'relief', 'grateful', 'burnout', 'feeling'],
  treatment_response: ['responding', 'shrinking', 'improving', 'worsening', 'side effect', 'nausea', 'fatigue', 'chemo', 'radiation', 'immunotherapy', 'tumor', 'scan', 'cea', 'remission'],
};

/**
 * Load memories for a user, ordered by most recently referenced first.
 * Pass categories to filter by specific categories only.
 */
export async function loadMemories(userId: string, limit = 150, categories?: string[]): Promise<Memory[]> {
  try {
    const whereClause = categories?.length
      ? and(eq(memories.userId, userId), inArray(memories.category, categories))
      : eq(memories.userId, userId);

    const data = await db
      .select(MEMORY_COLS)
      .from(memories)
      .where(whereClause)
      .orderBy(desc(memories.lastReferenced))
      .limit(limit);
    return data as Memory[];
  } catch (error) {
    console.error('[memory] load failed:', error);
    return [];
  }
}

/**
 * Legacy keyword-matching retrieval. Kept for fallback when
 * ENABLE_MEMORY_HYBRID is not 'true'.
 */
async function loadRelevantMemoriesLegacy(
  userId: string,
  userMessage: string,
  limit = 50,
): Promise<Memory[]> {
  try {
    const msgLower = userMessage.toLowerCase();
    const categories = new Set<string>(['condition', 'allergy']);

    for (const [category, signals] of Object.entries(CATEGORY_SIGNALS)) {
      if (signals.some((signal) => msgLower.includes(signal))) {
        categories.add(category);
      }
    }

    if (/\b\w+\s+\d+\s*mg\b/i.test(userMessage)) {
      categories.add('medication');
    }

    return loadMemories(userId, limit, Array.from(categories));
  } catch {
    return loadMemories(userId, limit);
  }
}

/**
 * Hybrid retrieval: pgvector cosine + Postgres BM25 fused with RRF,
 * reranked via Voyage rerank-2.5-lite. Always prepends tier-1 safety facts
 * (asserted + active allergy/condition/medication). Falls back to legacy
 * keyword path when ENABLE_MEMORY_HYBRID != 'true'.
 */
export async function loadRelevantMemories(
  userId: string,
  userMessage: string,
  limit = 8,
): Promise<Memory[]> {
  if (process.env.ENABLE_MEMORY_HYBRID !== 'true') {
    return loadRelevantMemoriesLegacy(userId, userMessage, 50);
  }

  const trimmed = (userMessage ?? '').trim();
  if (trimmed.length === 0) {
    const tier1Only = await tier1Facts(userId);
    await logAccess(userId, tier1Only.map((m) => m.id), 'chat_context_empty');
    return tier1Only;
  }

  const tier1 = await tier1Facts(userId);

  const queryVec = await embedQuery(trimmed);
  const queryVecLit = toHalfvecLiteral(queryVec);

  const top50 = await db.execute<{ id: string; fact: string }>(sql`
    WITH vec AS (
      SELECT id, embedding <=> ${queryVecLit}::halfvec AS dist
      FROM memories
      WHERE user_id = ${userId}::uuid
        AND embedding IS NOT NULL
        AND valid_to IS NULL AND tier != 1
        AND (decay_at IS NULL OR decay_at > NOW())
      ORDER BY dist
      LIMIT 30
    ),
    vec_ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY dist) AS rnk FROM vec
    ),
    kw AS (
      SELECT id, ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(fact_tsv, plainto_tsquery('english', ${trimmed})) DESC
      ) AS rnk
      FROM memories
      WHERE user_id = ${userId}::uuid AND valid_to IS NULL AND tier != 1
        AND (decay_at IS NULL OR decay_at > NOW())
        AND fact_tsv @@ plainto_tsquery('english', ${trimmed})
      LIMIT 30
    ),
    fused AS (
      SELECT m.id, m.fact,
        COALESCE(1.0/(60 + v.rnk), 0) AS vec_score,
        COALESCE(1.0/(60 + k.rnk), 0) AS kw_score,
        EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(m.last_referenced, m.created_at))) / 86400.0 / 30.0) AS recency,
        m.importance, m.seen_count, m.trust
      FROM memories m
      LEFT JOIN vec_ranked v ON v.id = m.id
      LEFT JOIN kw         k ON k.id = m.id
      WHERE (v.id IS NOT NULL OR k.id IS NOT NULL)
        AND m.user_id = ${userId}::uuid AND m.valid_to IS NULL
    )
    SELECT id, fact
    FROM (
      SELECT id, fact,
        0.5 * (vec_score + kw_score) +
        0.2 * recency +
        0.1 * (importance::float * LN(1 + seen_count)) +
        0.2 * trust::float AS final_score
      FROM fused
    ) s
    ORDER BY final_score DESC
    LIMIT 50
  `);

  const candidates = top50.rows.map((r) => ({ id: r.id, text: r.fact }));
  const { items: reranked, usedReranker } = await rerank(trimmed, candidates, limit);

  const tier1Ids = new Set(tier1.map((m) => m.id));
  const fetchIds = reranked.map((c) => c.id).filter((id) => !tier1Ids.has(id));

  let extras: Memory[] = [];
  if (fetchIds.length > 0) {
    const rows = await db.select(MEMORY_COLS).from(memories).where(inArray(memories.id, fetchIds));
    const byId = new Map<string, Memory>();
    for (const r of rows as Memory[]) byId.set(r.id, r);
    // Preserve reranker order
    extras = reranked.map((c) => byId.get(c.id)).filter((m): m is Memory => Boolean(m));
  }

  const result: Memory[] = [...tier1, ...extras].slice(0, TIER1_CAP + limit);

  await logAccess(
    userId,
    result.map((m) => m.id),
    usedReranker ? 'chat_context' : 'chat_context_no_rerank',
  );

  return result;
}

async function tier1Facts(userId: string): Promise<Memory[]> {
  const rows = await db
    .select(MEMORY_COLS)
    .from(memories)
    .where(
      and(
        eq(memories.userId, userId),
        eq(memories.tier, 1),
        eq(memories.polarity, 'asserted'),
        eq(memories.status, 'active'),
        isNull(memories.validTo),
        or(isNull(memories.decayAt), gt(memories.decayAt, sql`NOW()`)),
      ),
    )
    .orderBy(desc(memories.importance), sql`${memories.lastReferenced} DESC NULLS LAST`)
    .limit(TIER1_CAP);
  return rows as Memory[];
}

async function logAccess(userId: string, ids: string[], reason: string): Promise<void> {
  if (ids.length === 0) return;
  try {
    await db.insert(memoryAccessLog).values({
      userId,
      memoryIds: ids,
      reason,
    });
  } catch (e) {
    console.error('[memory] AUDIT LOG WRITE FAILED', {
      userId,
      reason,
      error: (e as Error).message,
    });
    throw e;
  }
}

/**
 * Load recent conversation summaries for context.
 */
export async function loadConversationSummaries(
  userId: string,
  limit = 5,
): Promise<ConversationSummary[]> {
  try {
    const data = await db
      .select()
      .from(conversationSummaries)
      .where(eq(conversationSummaries.userId, userId))
      .orderBy(desc(conversationSummaries.createdAt))
      .limit(limit);
    return data as ConversationSummary[];
  } catch (error) {
    console.error('[memory] summaries load failed:', error);
    return [];
  }
}
