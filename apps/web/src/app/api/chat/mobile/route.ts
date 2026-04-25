import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { careProfiles, medications, doctors, appointments, labResults, symptomEntries, messages, conversations, treatmentCycles } from '@/lib/db/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { extractAndSaveMemories, loadMemories, loadConversationSummaries } from '@/lib/memory';
import { validateCsrf } from '@/lib/csrf';
import { ApiErrors } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const TAG_OPTIONS = ['Labs', 'Medications', 'Side Effects', 'Appointments', 'Emotional Support', 'Insurance'] as const;

async function autoTitleConversation(conversationId: string, userId: string, firstUserMsg: string, firstAiMsg: string) {
  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      maxOutputTokens: 60,
      system: `You generate short conversation titles and topic tags for a cancer care app.
Given the first exchange in a conversation, output JSON with:
- "title": 4-6 words describing the topic (e.g. "Cycle 4 nausea questions", "CA-15-3 results explained")
- "tags": array of 1-2 tags from exactly: ${TAG_OPTIONS.join(', ')}
Output only valid JSON, no markdown.`,
      messages: [
        { role: 'user', content: `User: ${firstUserMsg}\nAI: ${firstAiMsg}` }
      ],
    });
    const parsed = JSON.parse(text.trim()) as { title?: string; tags?: string[] };
    await db
      .update(conversations)
      .set({
        title: parsed.title ?? null,
        tags: parsed.tags ?? [],
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));
  } catch {
    // Silent fail — timestamp title is the fallback
  }
}

export async function POST(req: Request) {
  // Bearer token auth (mobile) is not vulnerable to CSRF — skip cookie check
  const isBearerAuth = req.headers.get('authorization')?.startsWith('Bearer ')
  if (!isBearerAuth) {
    const { valid, error: csrfError } = await validateCsrf(req);
    if (!valid) return csrfError!;
  }

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) return ApiErrors.rateLimited();

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  let inputMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  let conversationId: string | undefined;
  try {
    const body = await req.json();
    inputMessages = body.messages;
    conversationId = body.conversationId;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const lastUserMessage = [...inputMessages].reverse().find(m => m.role === 'user');
  if (!lastUserMessage) return NextResponse.json({ error: 'No user message' }, { status: 400 });

  // Create or verify conversation
  let activeConversationId = conversationId;
  if (!activeConversationId) {
    const [newConvo] = await db
      .insert(conversations)
      .values({ userId: user!.id })
      .returning({ id: conversations.id });
    activeConversationId = newConvo.id;
  }

  try {
    const [profile] = await db
      .select()
      .from(careProfiles)
      .where(eq(careProfiles.userId, user!.id))
      .limit(1);

    const [meds, docs, appts, labs, memoriesData, conversationSummariesData, symptoms, activeCycleRows] = await Promise.all([
      profile?.id ? db.select().from(medications).where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt))).limit(30).catch(() => []) : Promise.resolve([]),
      profile?.id ? db.select().from(doctors).where(and(eq(doctors.careProfileId, profile.id), isNull(doctors.deletedAt))).limit(20).catch(() => []) : Promise.resolve([]),
      profile?.id ? db.select().from(appointments).where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt))).limit(20).catch(() => []) : Promise.resolve([]),
      db.select().from(labResults).where(eq(labResults.userId, user!.id)).orderBy(desc(labResults.dateTaken)).limit(20).catch(() => []),
      loadMemories(user!.id).catch(() => []),
      loadConversationSummaries(user!.id).catch(() => []),
      db.select().from(symptomEntries).where(eq(symptomEntries.userId, user!.id)).orderBy(desc(symptomEntries.date)).limit(14).catch(() => []),
      profile?.id ? db.select().from(treatmentCycles).where(and(eq(treatmentCycles.careProfileId, profile.id), eq(treatmentCycles.isActive, true))).limit(1).catch(() => []) : Promise.resolve([]),
    ]);
    const [activeCycle] = activeCycleRows;

    const systemPrompt = buildSystemPrompt(
      profile,
      meds,
      docs,
      appts,
      { labResults: labs, notifications: [], claims: [], priorAuths: [], fsaHsa: [], memories: memoriesData, conversationSummaries: conversationSummariesData, symptoms, treatmentCycle: activeCycle ?? null }
    );

    // Save user message with conversation
    await db.insert(messages).values({
      userId: user!.id,
      conversationId: activeConversationId,
      role: 'user',
      content: lastUserMessage.content,
    });

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      maxOutputTokens: 1024,
      system: systemPrompt,
      messages: inputMessages.map(m => ({ role: m.role, content: m.content })),
    });

    // Save assistant message with conversation
    await db.insert(messages).values({
      userId: user!.id,
      conversationId: activeConversationId,
      role: 'assistant',
      content: text,
    });

    // Update conversation timestamp + last message preview
    const preview = text.slice(0, 80).replace(/\n/g, ' ')
    await db.update(conversations).set({
      updatedAt: new Date(),
      lastMessagePreview: preview,
    }).where(eq(conversations.id, activeConversationId));

    // Background: extract memories + auto-title on first exchange
    const isFirstExchange = inputMessages.filter(m => m.role === 'user').length === 1;
    extractAndSaveMemories(user!.id, profile?.id ?? null, lastUserMessage.content, text, memoriesData).catch(() => {});
    if (isFirstExchange) {
      autoTitleConversation(activeConversationId, user!.id, lastUserMessage.content, text).catch(() => {});
    }

    return NextResponse.json({ content: text, conversationId: activeConversationId });
  } catch (err) {
    console.error('[chat/mobile] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
