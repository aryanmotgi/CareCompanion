import { anthropic } from '@ai-sdk/anthropic';
import { streamText, type UIMessage } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildSystemPrompt } from '@/lib/system-prompt';

export const maxDuration = 30;

export async function POST(req: Request) {
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

  const { data: medications } = await supabase
    .from('medications')
    .select('*')
    .eq('care_profile_id', profile?.id || '');

  const { data: doctors } = await supabase
    .from('doctors')
    .select('*')
    .eq('care_profile_id', profile?.id || '');

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('care_profile_id', profile?.id || '');

  // Fetch synced data for agent awareness
  const [
    { data: labResults },
    { data: notifications },
    { data: claims },
    { data: priorAuths },
    { data: fsaHsa },
  ] = await Promise.all([
    supabase.from('lab_results').select('*').eq('user_id', user.id).order('date_taken', { ascending: false }).limit(10),
    supabase.from('notifications').select('*').eq('user_id', user.id).eq('is_read', false).limit(10),
    supabase.from('claims').select('*').eq('user_id', user.id).eq('status', 'denied').limit(5),
    supabase.from('prior_auths').select('*').eq('user_id', user.id),
    supabase.from('fsa_hsa').select('*').eq('user_id', user.id),
  ]);

  const systemPrompt = buildSystemPrompt(
    profile,
    medications,
    doctors,
    appointments,
    { labResults, notifications, claims, priorAuths, fsaHsa }
  );

  // Save the user message
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === 'user') {
    const textContent = lastMessage.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('') || '';

    if (textContent) {
      await supabase.from('messages').insert({
        user_id: user.id,
        role: 'user',
        content: textContent,
      });
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

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages: conversationMessages,
    onFinish: async ({ text }) => {
      const admin = createAdminClient();
      await admin.from('messages').insert({
        user_id: user.id,
        role: 'assistant',
        content: text,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
