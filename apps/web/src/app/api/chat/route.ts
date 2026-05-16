import { anthropic } from '@ai-sdk/anthropic';
import { streamText, stepCountIs, type UIMessage, type SystemModelMessage } from 'ai';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { careProfiles, medications, doctors, appointments, labResults, notifications, claims, priorAuths, fsaHsa, symptomEntries, insurance, messages, treatmentCycles } from '@/lib/db/schema';
import { eq, desc, and, isNull, sql } from 'drizzle-orm';
import { buildSystemPromptBlocks, buildRoleContext } from '@/lib/system-prompt';
import { buildTools } from '@/lib/tools';
import { extractAndSaveMemories, loadMemories, loadRelevantMemories, loadConversationSummaries, touchReferencedMemories, summarizeConversation } from '@/lib/memory';
import { hybridEnabledForUser } from '@/lib/memory/gate';
import { orchestrate } from '@/lib/agents/orchestrator';
import { isSimpleMessage } from '@/lib/agents/router';
import { rateLimit } from '@/lib/rate-limit';
import { ApiErrors } from '@/lib/api-response';
import { withMetrics } from '@/lib/api-metrics';
import { logAudit } from '@/lib/audit';
import { validateCsrf } from '@/lib/csrf';
import { reserveBudget, recordUsage, estimateTokens } from '@/lib/budget';

const ipLimiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 30 });
const userLimiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 10 });

// Vercel Pro/Fluid Compute allows up to 300s. Chat pipeline (Aurora cold-start
// + orchestrator + Claude streaming) can exceed 60s under load, causing
// ERR_ABORTED mid-stream and "Having trouble connecting" in the UI.
export const maxDuration = 300;

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

  // CSRF validation — client sends x-csrf-token header via DefaultChatTransport
  const { valid: csrfValid, error: csrfError } = await validateCsrf(req);
  if (!csrfValid) return csrfError!;

  // Demo mode: skip the full pipeline and return a brief response with signup CTA
  if (dbUser!.isDemo === true) {
    const { messages: msgs }: { messages: UIMessage[] } = await req.json();
    const lastMessage = msgs[msgs.length - 1];
    const userText = lastMessage?.role === 'user'
      ? (lastMessage.parts?.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map((p) => p.text).join('') || '')
      : '';

    const demoResult = streamText({
      model: anthropic('claude-sonnet-4-6'),
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

  // Atomic daily budget reservation (rolled back if cap exceeded)
  const estimate = estimateTokens(JSON.stringify(msgs));
  const reservation = await reserveBudget(dbUser!.id, estimate);
  if (!reservation.ok) {
    return new Response(JSON.stringify({ error: reservation.reason }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Pre-screen for dangerous account-management intents (Bug #6)
  const lastMsg = msgs[msgs.length - 1];
  const userMessageText = lastMsg?.role === 'user'
    ? (lastMsg.parts?.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map((p) => p.text).join('') || '')
    : '';

  if (lastMsg?.role === 'user') {
    const userText = userMessageText;
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
    (userMessageText
      ? loadRelevantMemories(dbUser!.id, userMessageText, 8, { hybrid: hybridEnabledForUser(dbUser!.id) })
      : loadMemories(dbUser!.id, 50)
    ).catch(() => []),
    loadConversationSummaries(dbUser!.id).catch(() => []),
    db.select().from(symptomEntries).where(eq(symptomEntries.userId, dbUser!.id)).orderBy(desc(symptomEntries.date)).limit(14).catch(() => []),
    db.select().from(insurance).where(eq(insurance.userId, dbUser!.id)).limit(1).catch(() => []),
    profile?.id ? db.select().from(treatmentCycles).where(and(eq(treatmentCycles.careProfileId, profile.id), eq(treatmentCycles.isActive, true))).limit(1).catch(() => []) : Promise.resolve([]),
  ]);
  const [ins] = insRows;
  const [activeCycle] = activeCycleRows;

  // Save the user message
  if (userMessageText) {
    await db.insert(messages).values({
      userId: dbUser!.id,
      role: 'user',
      content: userMessageText,
    });

    // Touch referenced memories (non-blocking)
    touchReferencedMemories(dbUser!.id, userMessageText, memoriesData).catch(() => {});
  }

  // Server-side message count for summarization trigger
  const [{ msgCount }] = await db
    .select({ msgCount: sql<number>`count(*)` })
    .from(messages)
    .where(eq(messages.userId, dbUser!.id));

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
  const conversationHistory = conversationMessages
    .slice(-8)
    .map((m) => {
      const label = m.role === 'user' ? 'User' : 'Assistant';
      const content = m.content.length > 500 ? m.content.slice(0, 500) + '…' : m.content;
      return `${label}: ${content}`;
    })
    .join('\n');

  const roleContext = buildRoleContext({
    role: dbUser!.role ?? null,
    primaryConcern: profile?.primaryConcern ?? null,
    caregivingExperience: profile?.caregivingExperience ?? null,
  })

  const promptBlocks = buildSystemPromptBlocks(
    profile,
    meds,
    docs,
    appts,
    {
      labResults: labs,
      notifications: notifs,
      claims: claimsData,
      priorAuths: priorAuthsData,
      fsaHsa: fsaHsaData,
      memories: memoriesData,
      conversationSummaries: conversationSummariesData,
      symptoms,
      treatmentCycle: activeCycle || null,
      roleContext,
    },
  );

  // Cache control for system blocks (used by both simple + full paths)
  const enableCache = process.env.ENABLE_PROMPT_CACHE === 'true';
  const cacheAttr = enableCache
    ? { providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' as const } } } }
    : {};

  // Smart-routing fast path for trivial messages (greetings, ack).
  // STILL preserves: tier-1 memory injection, audit log (via load), conversation
  // save, usage record. Only the orchestrator + tool-heavy main stream are skipped.
  if (userMessageText && isSimpleMessage(userMessageText)) {
    const simpleSystem: SystemModelMessage[] = [];
    if (promptBlocks.base) simpleSystem.push({ role: 'system', content: promptBlocks.base, ...cacheAttr });
    if (promptBlocks.userStable) simpleSystem.push({ role: 'system', content: promptBlocks.userStable, ...cacheAttr });
    if (promptBlocks.retrieved) simpleSystem.push({ role: 'system', content: promptBlocks.retrieved });

    const simple = streamText({
      model: anthropic('claude-haiku-4-5-20251001'),
      maxOutputTokens: 512,
      system: simpleSystem,
      messages: conversationMessages,
      onFinish: async ({ text, usage }) => {
        if (text) {
          await db.insert(messages).values({
            userId: dbUser!.id,
            role: 'assistant',
            content: text,
          });
        }
        await recordUsage(dbUser!.id, estimate, {
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          cacheRead: usage?.cachedInputTokens ?? 0,
          cacheCreate: 0,
        });
      },
    });
    return simple.toUIMessageStreamResponse();
  }

  const orchestratorResult = userMessageText
    ? await orchestrate(userMessageText, conversationHistory, {
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
    : { specialistsUsed: [], agentOutputs: {}, synthesizedContext: '', isMultiAgent: false };

  // 4-block system: L1+L2 marked cacheable (stable); L3 (per-turn) + L4
  // (retrieved) + specialist context unmarked. Cache control only attached when
  // ENABLE_PROMPT_CACHE=true (enableCache + cacheAttr defined above).
  const systemMessages: SystemModelMessage[] = [];
  if (promptBlocks.base) {
    systemMessages.push({ role: 'system', content: promptBlocks.base, ...cacheAttr });
  }
  if (promptBlocks.userStable) {
    systemMessages.push({ role: 'system', content: promptBlocks.userStable, ...cacheAttr });
  }
  if (promptBlocks.userDynamic) {
    systemMessages.push({ role: 'system', content: promptBlocks.userDynamic });
  }
  const tailBlock = (promptBlocks.retrieved ?? '') + (orchestratorResult.synthesizedContext ?? '');
  if (tailBlock) {
    systemMessages.push({ role: 'system', content: tailBlock });
  }

  // Build tools for this user session
  const tools = buildTools(dbUser!.id, profile?.id || null);

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    maxOutputTokens: 4096,
    system: systemMessages,
    messages: conversationMessages,
    tools,
    stopWhen: stepCountIs(10),
    onFinish: async ({ text, steps, usage }) => {
      // Cache telemetry — AI SDK v6 reports cache reads via `cachedInputTokens`.
      // No separate creation-token field; first call seeds the cache implicitly.
      console.log('[chat-cache]', JSON.stringify({
        userId: dbUser!.id,
        cachedInputTokens: usage?.cachedInputTokens ?? 0,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        cacheEnabled: enableCache,
      }));
      // Fallback message if model used all tool steps but produced no text
      const finalText = (!text || text.length < 20) && steps && steps.length >= 10
        ? "I ran into a complexity limit on that request. Could you try breaking it into smaller questions?"
        : text;

      // Save assistant message
      if (finalText) {
        await db.insert(messages).values({
          userId: dbUser!.id,
          role: 'assistant',
          content: finalText,
        });
      }

      // Extract and save new memories — skip very short responses (no extractable facts)
      if (userMessageText && finalText && finalText.length >= 50) {
        extractAndSaveMemories(
          dbUser!.id,
          profile?.id || null,
          userMessageText,
          finalText,
          memoriesData,
        ).catch((err) => console.error('[memory] background extraction error:', err));
      }

      // Summarize conversation every 20 messages using server-side count
      if (Number(msgCount) > 0 && Number(msgCount) % 20 === 0) {
        summarizeConversation(dbUser!.id, conversationMessages)
          .catch((err) => console.error('[memory] background summarization error:', err));
      }

      // Reconcile budget reservation with actual usage
      await recordUsage(dbUser!.id, estimate, {
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        cacheRead: usage?.cachedInputTokens ?? 0,
        cacheCreate: 0,
      }).catch((err) => console.error('[budget] recordUsage failed:', err));
    },
  });

  return result.toUIMessageStreamResponse();
}

export const POST = withMetrics('/api/chat', handler);
