import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Memory, ConversationSummary } from './types';

// ============================================================
// Memory Extraction — runs after every assistant response
// ============================================================

const MEMORY_CATEGORIES = [
  'medication', 'condition', 'allergy', 'insurance', 'financial',
  'appointment', 'preference', 'family', 'provider', 'lab_result',
  'lifestyle', 'legal', 'other',
] as const;

const extractionSchema = z.object({
  facts: z.array(z.object({
    category: z.enum(MEMORY_CATEGORIES),
    fact: z.string().describe('A single, specific fact. Include names, numbers, dates. E.g. "Mom takes Lisinopril 10mg once daily for blood pressure"'),
    confidence: z.enum(['high', 'medium', 'low']).describe('high = explicitly stated, medium = strongly implied, low = inferred'),
  })).describe('New facts from this conversation that should be remembered forever. Only include facts NOT already in existing memories.'),
});

// Skip memory extraction for trivial messages (greetings, short responses)
const SKIP_PATTERNS = /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|bye|goodbye|good morning|good night|got it)\b/i;
const MIN_MESSAGE_LENGTH = 20; // Skip if both messages are very short

/**
 * Extract new facts from the latest conversation exchange and save to Supabase.
 * Runs asynchronously after each assistant response — does not block the chat stream.
 *
 * Includes cost-saving guards:
 * - Skips greetings and trivial messages
 * - Skips when both messages are very short
 * - Deduplicates within a 1-hour window per user
 */
export async function extractAndSaveMemories(
  userId: string,
  careProfileId: string | null,
  userMessage: string,
  assistantMessage: string,
  existingMemories: Memory[],
): Promise<void> {
  try {
    // Guard: skip trivial messages to save API costs
    if (SKIP_PATTERNS.test(userMessage.trim())) return;
    if (userMessage.length < MIN_MESSAGE_LENGTH && assistantMessage.length < MIN_MESSAGE_LENGTH) return;

    // Guard: check dedup window — skip if we extracted within the last minute for this user
    const admin = createAdminClient();
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentMemories } = await admin
      .from('memories')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', oneMinuteAgo)
      .limit(1);

    if (recentMemories && recentMemories.length > 0) return;

    const existingFacts = existingMemories.map((m) => `[${m.category}] ${m.fact}`).join('\n');

    const { object } = await generateObject({
      model: anthropic('claude-haiku-4-5-20251001'),
      schema: extractionSchema,
      prompt: `You are a memory extraction system for a family caregiver AI assistant.

Read this conversation exchange and extract any NEW facts worth remembering forever.
These facts help the AI remember everything about the patient, caregiver, and their situation.

EXISTING MEMORIES (do NOT duplicate these):
${existingFacts || '(none yet)'}

LATEST EXCHANGE:
User: ${userMessage}
Assistant: ${assistantMessage}

Rules:
- Only extract CONCRETE facts — names, medications, dosages, dates, doctors, conditions, preferences, insurance details, financial info
- One fact per entry — keep each fact atomic and specific
- Skip small talk, greetings, and emotional expressions (but DO capture preferences like "caregiver prefers plain language")
- Skip anything already captured in existing memories
- If the user corrects a previous fact, extract the CORRECTED version as a new high-confidence fact
- Confidence: "high" if the user explicitly stated it, "medium" if strongly implied, "low" if you inferred it`,
    });

    if (object.facts.length === 0) return;

    const rows = object.facts.map((f) => ({
      user_id: userId,
      care_profile_id: careProfileId,
      category: f.category,
      fact: f.fact,
      source: 'conversation' as const,
      confidence: f.confidence,
    }));

    await admin.from('memories').insert(rows);
  } catch (error) {
    // Memory extraction is non-critical — log but don't throw
    console.error('[memory] extraction failed:', error);
  }
}

// ============================================================
// Memory Loading — fetch all memories for context building
// ============================================================

/**
 * Load memories for a user, ordered by most recently referenced first.
 * Limited to 150 to prevent context explosion in the system prompt.
 */
export async function loadMemories(userId: string, limit = 150): Promise<Memory[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .order('last_referenced', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[memory] load failed:', error);
    return [];
  }
  return data || [];
}

/**
 * Load recent conversation summaries for context.
 */
export async function loadConversationSummaries(
  userId: string,
  limit = 5,
): Promise<ConversationSummary[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('conversation_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[memory] summaries load failed:', error);
    return [];
  }
  return data || [];
}

// ============================================================
// Memory Referencing — update last_referenced when used
// ============================================================

/**
 * Touch memories that are relevant to the current conversation.
 * Uses keyword matching against the user message to find referenced memories.
 */
export async function touchReferencedMemories(
  userId: string,
  userMessage: string,
  memories: Memory[],
): Promise<void> {
  const messageLower = userMessage.toLowerCase();
  const referencedIds: string[] = [];

  for (const mem of memories) {
    // Extract key terms from the fact (words 4+ chars, excluding common words)
    const terms = mem.fact.toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .filter((w) => !['that', 'this', 'with', 'from', 'have', 'been', 'they', 'their', 'about', 'would', 'should', 'could'].includes(w));

    // If any meaningful term from the memory appears in the message, it's referenced
    const isReferenced = terms.some((term) => messageLower.includes(term));
    if (isReferenced) {
      referencedIds.push(mem.id);
    }
  }

  if (referencedIds.length === 0) return;

  const admin = createAdminClient();
  await admin
    .from('memories')
    .update({ last_referenced: new Date().toISOString() })
    .in('id', referencedIds);
}

// ============================================================
// Conversation Summarization — runs periodically
// ============================================================

const summarySchema = z.object({
  summary: z.string().describe('A 2-3 sentence summary of what was discussed and any decisions made'),
  topics: z.array(z.string()).describe('Key topics covered, e.g. ["medications", "insurance denial", "appointment scheduling"]'),
});

/**
 * Generate and save a conversation summary.
 * Call this when a conversation session ends or after a threshold of messages.
 */
export async function summarizeConversation(
  userId: string,
  messages: { role: string; content: string }[],
): Promise<void> {
  if (messages.length < 4) return; // Not enough to summarize

  try {
    const transcript = messages
      .slice(-30) // Last 30 messages max
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const { object } = await generateObject({
      model: anthropic('claude-haiku-4-5-20251001'),
      schema: summarySchema,
      prompt: `Summarize this caregiver AI conversation. Focus on: decisions made, information shared, action items, and emotional state of the caregiver.

${transcript}`,
    });

    const admin = createAdminClient();
    await admin.from('conversation_summaries').insert({
      user_id: userId,
      summary: object.summary,
      topics: object.topics,
      message_count: messages.length,
    });
  } catch (error) {
    console.error('[memory] summarization failed:', error);
  }
}
