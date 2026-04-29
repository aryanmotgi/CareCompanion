import { anthropic } from '@ai-sdk/anthropic';
import { streamText, stepCountIs, type UIMessage } from 'ai';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { careProfiles, medications, doctors, appointments, labResults, notifications, claims, priorAuths, fsaHsa, symptomEntries, insurance, messages, treatmentCycles } from '@/lib/db/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { buildSystemPrompt, buildRoleContext } from '@/lib/system-prompt';
import { buildTools } from '@/lib/tools';
import { extractAndSaveMemories, loadMemories, loadConversationSummaries, touchReferencedMemories, summarizeConversation } from '@/lib/memory';
import { orchestrate } from '@/lib/agents/orchestrator';
import { rateLimit } from '@/lib/rate-limit';
import { ApiErrors } from '@/lib/api-response';
import { withMetrics } from '@/lib/api-metrics';
import { logAudit } from '@/lib/audit';

const ipLimiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 30 });
const userLimiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 10 });

// maxDuration = 60s requires Vercel Pro plan or higher. Hobby plan caps at 10s.
export const maxDuration = 60;

async function handler(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success: ipSuccess } = await ipLimiter.check(ip);
  if (!ipSuccess) {
    return ApiErrors.rateLimited();
  }

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  // Audit log PHI access (fire-and-forget)
  logAudit({
    user_id: dbUser!.id,
    action: 'view_records',
    ip_address: ip,
  }).catch(() => {});

  const { success: userSuccess } = await userLimiter.check(dbUser!.id);
  if (!userSuccess) {
    return ApiErrors.rateLimited();
  }

  // Demo mode: skip the full pipeline and return a brief response with signup CTA
  if (dbUser!.isDemo === true) {
    const { messages: msgs }: { messages: UIMessage[] } = await req.json();
    const lastMessage = msgs[msgs.length - 1];
    const userText = lastMessage?.role === 'user'
      ? (lastMessage.parts?.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map((p) => p.text).join('') || '')
      : '';

    const demoResult = streamText({
      model: anthropic('claude-sonnet-4.6'),
      maxOutputTokens: 512,
      system: `You are CareCompanion AI. The user is in demo mode exploring the app.
Give a short, helpful 1-2 sentence answer about their question as it relates to cancer care.
Then end with exactly this line on its own: "Sign up for free to save your conversations and get full AI-powered care insights."
Be warm and concise. Never say you are in demo mode or mention limitations.`,
      messages: [{ role: 'user', content: userText || 'Hello' }],
    });

    return demoResult.toUIMessageStreamResponse();
  }

  let msgs: UIMessage[];
  try {
    const body = await req.json();
    msgs = body.messages;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Pre-screen for dangerous account-management intents (Bug #6)
  const lastMsg = msgs[msgs.length - 1];
  if (lastMsg?.role === 'user') {
    const userText = lastMsg.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('') || '';
    const dangerousIntentPattern = /\b(delete\s+(my\s+)?account|cancel\s+(my\s+)?(subscription|plan|membership)|change\s+(my\s+)?password|reset\s+(my\s+)?password|close\s+(my\s+)?account|deactivate\s+(my\s+)?account)\b/i;
    if (dangerousIntentPattern.test(userText)) {
      const encoder = new TextEncoder();
      const message = "I can\u2019t make account changes directly. You can manage your account, password, and subscription from the **Settings** page. Go to **Settings > Account** to make those changes safely.";
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`0:${JSON.stringify(message)}\n`));
          controller.enqueue(encoder.encode(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0},"isContinued":false}\n`));
          controller.enqueue(encoder.encode(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Vercel-AI-Data-Stream': 'v1' },
      });
    }
  }

  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser!.id))
    .limit(1);

  // Fetch all data in parallel — including memories and treatment cycle
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
    insRows,
    activeCycleRows,
  ] = await Promise.all([
    profile?.id ? db.select().from(medications).where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt))).limit(50).catch(() => []) : Promise.resolve([]),
    profile?.id ? db.select().from(doctors).where(and(eq(doctors.careProfileId, profile.id), isNull(doctors.deletedAt))).limit(50).catch(() => []) : Promise.resolve([]),
    profile?.id ? db.select().from(appointments).where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt))).limit(50).catch(() => []) : Promise.resolve([]),
    db.select().from(labResults).where(eq(labResults.userId, dbUser!.id)).orderBy(desc(labResults.dateTaken)).limit(20).catch(() => []),
    db.select().from(notifications).where(and(eq(notifications.userId, dbUser!.id), eq(notifications.isRead, false))).limit(10).catch(() => []),
    db.select().from(claims).where(and(eq(claims.userId, dbUser!.id), eq(claims.status, 'denied'))).limit(5).catch(() => []),
    db.select().from(priorAuths).where(eq(priorAuths.userId, dbUser!.id)).limit(50).catch(() => []),
    db.select().from(fsaHsa).where(eq(fsaHsa.userId, dbUser!.id)).limit(50).catch(() => []),
    loadMemories(dbUser!.id).catch(() => []),
    loadConversationSummaries(dbUser!.id).catch(() => []),
    db.select().from(symptomEntries).where(eq(symptomEntries.userId, dbUser!.id)).orderBy(desc(symptomEntries.date)).limit(14).catch(() => []),
    db.select().from(insurance).where(eq(insurance.userId, dbUser!.id)).limit(1).catch(() => []),
    profile?.id ? db.select().from(treatmentCycles).where(and(eq(treatmentCycles.careProfileId, profile.id), eq(treatmentCycles.isActive, true))).limit(1).catch(() => []) : Promise.resolve([]),
  ]);
  const [ins] = insRows;
  const [activeCycle] = activeCycleRows;

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

  const roleContext = buildRoleContext({
    role: dbUser!.role ?? null,
    primaryConcern: profile?.primaryConcern ?? null,
    caregivingExperience: profile?.caregivingExperience ?? null,
  })

  const [orchestratorResult, baseSystemPrompt] = await Promise.all([
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
      { labResults: labs, notifications: notifs, claims: claimsData, priorAuths: priorAuthsData, fsaHsa: fsaHsaData, memories: memoriesData, conversationSummaries: conversationSummariesData, symptoms, treatmentCycle: activeCycle || null }
    )),
  ]);

  const systemPrompt = roleContext
    ? `${roleContext}\n\n${baseSystemPrompt}`
    : baseSystemPrompt

  // Append specialist context to system prompt if multi-agent was used
  const fullSystemPrompt = orchestratorResult.synthesizedContext
    ? systemPrompt + orchestratorResult.synthesizedContext
    : systemPrompt;

  // Build tools for this user session
  const tools = buildTools(dbUser!.id, profile?.id || null);

  const result = streamText({
    model: anthropic('claude-sonnet-4.6'),
    maxOutputTokens: 4096,
    system: fullSystemPrompt,
    messages: conversationMessages,
    tools,
    stopWhen: stepCountIs(10),
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
