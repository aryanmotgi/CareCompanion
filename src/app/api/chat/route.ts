import { anthropic } from '@ai-sdk/anthropic';
import { streamText, stepCountIs, type UIMessage } from 'ai';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { careProfiles, medications, doctors, appointments, labResults, notifications, claims, priorAuths, fsaHsa, symptomEntries, insurance, messages } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { buildTools } from '@/lib/tools';
import { extractAndSaveMemories, loadMemories, loadConversationSummaries, touchReferencedMemories, summarizeConversation } from '@/lib/memory';
import { orchestrate } from '@/lib/agents/orchestrator';
import { rateLimit } from '@/lib/rate-limit';
import { ApiErrors } from '@/lib/api-response';
import { withMetrics } from '@/lib/api-metrics';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 });

export const maxDuration = 60;

async function handler(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) {
    return ApiErrors.rateLimited();
  }

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  // Demo mode: skip the full pipeline and return a brief response with signup CTA
  if (dbUser!.isDemo === true) {
    const { messages: msgs }: { messages: UIMessage[] } = await req.json();
    const lastMessage = msgs[msgs.length - 1];
    const userText = lastMessage?.role === 'user'
      ? (lastMessage.parts?.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map((p) => p.text).join('') || '')
      : '';

    const demoResult = streamText({
      model: anthropic('claude-haiku-4.5'),
      system: `You are CareCompanion AI. The user is in demo mode exploring the app.
Give a short, helpful 1-2 sentence answer about their question as it relates to cancer care.
Then end with exactly this line on its own: "Sign up for free to save your conversations and get full AI-powered care insights."
Be warm and concise. Never say you are in demo mode or mention limitations.`,
      messages: [{ role: 'user', content: userText || 'Hello' }],
    });

    return demoResult.toUIMessageStreamResponse();
  }

  const { messages: msgs }: { messages: UIMessage[] } = await req.json();

  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser!.id))
    .limit(1);

  // Fetch all data in parallel — including memories
  const [
    meds,
    docs,
    appts,
    labs,
    notifs,
    claimsData,
    priorAuthsData,
    fsaHsaData,
    memoriesData,
    conversationSummariesData,
    symptoms,
    [ins],
  ] = await Promise.all([
    db.select().from(medications).where(eq(medications.careProfileId, profile?.id || '')),
    db.select().from(doctors).where(eq(doctors.careProfileId, profile?.id || '')),
    db.select().from(appointments).where(eq(appointments.careProfileId, profile?.id || '')),
    db.select().from(labResults).where(eq(labResults.userId, dbUser!.id)).orderBy(desc(labResults.dateTaken)).limit(20),
    db.select().from(notifications).where(and(eq(notifications.userId, dbUser!.id), eq(notifications.isRead, false))).limit(10),
    db.select().from(claims).where(and(eq(claims.userId, dbUser!.id), eq(claims.status, 'denied'))).limit(5),
    db.select().from(priorAuths).where(eq(priorAuths.userId, dbUser!.id)),
    db.select().from(fsaHsa).where(eq(fsaHsa.userId, dbUser!.id)),
    loadMemories(dbUser!.id),
    loadConversationSummaries(dbUser!.id),
    db.select().from(symptomEntries).where(eq(symptomEntries.userId, dbUser!.id)).orderBy(desc(symptomEntries.date)).limit(14),
    db.select().from(insurance).where(eq(insurance.userId, dbUser!.id)).limit(1),
  ]);

  // Save the user message
  const lastMessage = msgs[msgs.length - 1];
  let userMessageText = '';
  if (lastMessage?.role === 'user') {
    userMessageText = lastMessage.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('') || '';

    if (userMessageText) {
      await db.insert(messages).values({
        userId: dbUser!.id,
        role: 'user',
        content: userMessageText,
      });

      // Touch referenced memories (non-blocking)
      touchReferencedMemories(dbUser!.id, userMessageText, memoriesData).catch(() => {});
    }
  }

  // Build conversation messages for Claude
  const conversationMessages = msgs.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content:
      msg.parts
        ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('') || '',
  }));

  // Run the multi-agent orchestrator in parallel with building the system prompt
  const conversationHistory = conversationMessages.slice(-6).map((m) => `${m.role}: ${m.content}`).join('\n');

  const [orchestratorResult, systemPrompt] = await Promise.all([
    userMessageText
      ? orchestrate(userMessageText, conversationHistory, {
          profile,
          medications: meds as Record<string, unknown>[],
          doctors: docs as Record<string, unknown>[],
          appointments: appts as Record<string, unknown>[],
          labResults: labs as Record<string, unknown>[],
          insurance: (ins || null) as Record<string, unknown> | null,
          claims: claimsData as Record<string, unknown>[],
          priorAuths: priorAuthsData as Record<string, unknown>[],
          fsaHsa: fsaHsaData as Record<string, unknown>[],
          memories: memoriesData as unknown as Record<string, unknown>[],
          symptoms: symptoms as Record<string, unknown>[],
        }, dbUser!.id)
      : Promise.resolve({ specialistsUsed: [], agentOutputs: {}, synthesizedContext: '', isMultiAgent: false }),
    Promise.resolve(buildSystemPrompt(
      profile,
      meds,
      docs,
      appts,
      { labResults: labs, notifications: notifs, claims: claimsData, priorAuths: priorAuthsData, fsaHsa: fsaHsaData, memories: memoriesData, conversationSummaries: conversationSummariesData, symptoms }
    )),
  ]);

  // Append specialist context to system prompt if multi-agent was used
  const fullSystemPrompt = orchestratorResult.synthesizedContext
    ? systemPrompt + orchestratorResult.synthesizedContext
    : systemPrompt;

  // Build tools for this user session
  const tools = buildTools(dbUser!.id, profile?.id || null);

  const result = streamText({
    model: anthropic('claude-sonnet-4.6'),
    system: fullSystemPrompt,
    messages: conversationMessages,
    tools,
    stopWhen: stepCountIs(5),
    onFinish: async ({ text }) => {
      // Save assistant message
      if (text) {
        await db.insert(messages).values({
          userId: dbUser!.id,
          role: 'assistant',
          content: text,
        });
      }

      // Extract and save new memories (non-blocking background job)
      if (userMessageText && text) {
        extractAndSaveMemories(
          dbUser!.id,
          profile?.id || null,
          userMessageText,
          text,
          memoriesData,
        ).catch((err) => console.error('[memory] background extraction error:', err));
      }

      // Summarize conversation every 20 messages
      if (msgs.length > 0 && msgs.length % 20 === 0) {
        summarizeConversation(dbUser!.id, conversationMessages)
          .catch((err) => console.error('[memory] background summarization error:', err));
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

export const POST = withMetrics('/api/chat', handler);
