import { db } from '@/lib/db';
import { memories, conversationSummaries } from '@/lib/db/schema';
import { eq, desc, inArray, and } from 'drizzle-orm';
import type { Memory, ConversationSummary } from './types';

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
      .select()
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
 * Load only memories relevant to the current message.
 * Always includes condition + allergy (critical safety). Falls back to full load on error.
 */
export async function loadRelevantMemories(
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
