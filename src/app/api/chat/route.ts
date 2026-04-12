import { anthropic } from '@ai-sdk/anthropic';
import { streamText, stepCountIs, type UIMessage } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
  const { success } = limiter.check(ip);
  if (!success) {
    return ApiErrors.rateLimited();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  // Fetch care context
  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Fetch all data in parallel — including memories
  const [
    { data: medications },
    { data: doctors },
    { data: appointments },
    { data: labResults },
    { data: notifications },
    { data: claims },
    { data: priorAuths },
    { data: fsaHsa },
    memories,
    conversationSummaries,
    { data: symptoms },
    { data: insurance },
  ] = await Promise.all([
    supabase.from('medications').select('*').eq('care_profile_id', profile?.id || ''),
    supabase.from('doctors').select('*').eq('care_profile_id', profile?.id || ''),
    supabase.from('appointments').select('*').eq('care_profile_id', profile?.id || ''),
    supabase.from('lab_results').select('*').eq('user_id', user.id).order('date_taken', { ascending: false }).limit(20),
    supabase.from('notifications').select('*').eq('user_id', user.id).eq('is_read', false).limit(10),
    supabase.from('claims').select('*').eq('user_id', user.id).eq('status', 'denied').limit(5),
    supabase.from('prior_auths').select('*').eq('user_id', user.id),
    supabase.from('fsa_hsa').select('*').eq('user_id', user.id),
    loadMemories(user.id),
    loadConversationSummaries(user.id),
    supabase.from('symptom_entries').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(14),
    supabase.from('insurance').select('*').eq('user_id', user.id).limit(1).single(),
  ]);

  // Save the user message
  const lastMessage = messages[messages.length - 1];
  let userMessageText = '';
  if (lastMessage?.role === 'user') {
    userMessageText = lastMessage.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('') || '';

    if (userMessageText) {
      await supabase.from('messages').insert({
        user_id: user.id,
        role: 'user',
        content: userMessageText,
      });

      // Touch referenced memories (non-blocking)
      touchReferencedMemories(user.id, userMessageText, memories).catch(() => {});
    }
  }

  // Build conversation messages for Claude
  const conversationMessages = messages.map((msg) => ({
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
          medications: (medications || []) as Record<string, unknown>[],
          doctors: (doctors || []) as Record<string, unknown>[],
          appointments: (appointments || []) as Record<string, unknown>[],
          labResults: (labResults || []) as Record<string, unknown>[],
          insurance: insurance as Record<string, unknown> | null,
          claims: (claims || []) as Record<string, unknown>[],
          priorAuths: (priorAuths || []) as Record<string, unknown>[],
          fsaHsa: (fsaHsa || []) as Record<string, unknown>[],
          memories: (memories || []) as unknown as Record<string, unknown>[],
          symptoms: (symptoms || []) as Record<string, unknown>[],
        }, user.id)
      : Promise.resolve({ specialistsUsed: [], agentOutputs: {}, synthesizedContext: '', isMultiAgent: false }),
    Promise.resolve(buildSystemPrompt(
      profile,
      medications,
      doctors,
      appointments,
      { labResults, notifications, claims, priorAuths, fsaHsa, memories, conversationSummaries }
    )),
  ]);

  // Append specialist context to system prompt if multi-agent was used
  const fullSystemPrompt = orchestratorResult.synthesizedContext
    ? systemPrompt + orchestratorResult.synthesizedContext
    : systemPrompt;

  // Build tools for this user session
  const tools = buildTools(user.id, profile?.id || null);

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: fullSystemPrompt,
    messages: conversationMessages,
    tools,
    stopWhen: stepCountIs(5),
    onFinish: async ({ text }) => {
      const admin = createAdminClient();

      // Save assistant message
      if (text) {
        await admin.from('messages').insert({
          user_id: user.id,
          role: 'assistant',
          content: text,
        });
      }

      // Extract and save new memories (non-blocking background job)
      if (userMessageText && text) {
        extractAndSaveMemories(
          user.id,
          profile?.id || null,
          userMessageText,
          text,
          memories,
        ).catch((err) => console.error('[memory] background extraction error:', err));
      }

      // Summarize conversation every 20 messages
      if (messages.length > 0 && messages.length % 20 === 0) {
        summarizeConversation(user.id, conversationMessages)
          .catch((err) => console.error('[memory] background summarization error:', err));
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

export const POST = withMetrics('/api/chat', handler);
