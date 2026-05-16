/**
 * ConvoMem mode: bypass hybrid retrieval for users with fewer than 30
 * sessions. On a near-empty memory corpus the hybrid CTE returns mostly
 * noise, and last-N raw messages outperform retrieved tier-3 fragments.
 *
 * The chat handler already has the last N raw messages in its request body
 * (`msgs.slice(-8)`), so ConvoMem mode only changes one thing on the
 * server: it returns just the tier-1 safety floor (allergies, active
 * medications, active conditions) and skips the hybrid CTE entirely.
 *
 * Dev-override: `FORCE_HYBRID_USER_IDS` env var (comma-separated UUIDs)
 * forces hybrid retrieval for listed users regardless of session count.
 * Without it, every test account would always be in ConvoMem mode and the
 * hybrid path would never get exercised.
 */
import { db } from '@/lib/db';
import { conversationSummaries } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

const SESSION_THRESHOLD = 30;

/**
 * Number of conversation_summaries rows for this user. Each row marks one
 * session boundary, so this is a cheap stand-in for lifetime session count.
 * Returns 0 on DB failure so the gate falls back to ConvoMem mode (safer
 * than letting hybrid retrieval run against an empty corpus).
 */
export async function countSessionsForUser(userId: string): Promise<number> {
  try {
    const rows = await db
      .select({ n: sql<number>`count(*)` })
      .from(conversationSummaries)
      .where(eq(conversationSummaries.userId, userId));
    return Number(rows[0]?.n ?? 0);
  } catch (err) {
    console.error('[convomem] countSessionsForUser failed:', err instanceof Error ? err.message : String(err));
    return 0;
  }
}

/**
 * True when ConvoMem mode should be used for this user.
 *
 * Logic:
 *   1. If userId is in FORCE_HYBRID_USER_IDS → false (override, never ConvoMem)
 *   2. Else, true when session count < 30
 */
export async function convoMemEnabledForUser(userId: string): Promise<boolean> {
  const forceList = (process.env.FORCE_HYBRID_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (forceList.includes(userId)) return false;

  const sessions = await countSessionsForUser(userId);
  return sessions < SESSION_THRESHOLD;
}
