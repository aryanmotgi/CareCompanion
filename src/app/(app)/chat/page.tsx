import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChatInterface } from '@/components/ChatInterface';
import type { Message } from '@/lib/types';

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id, patient_name')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/setup');

  const { data: dbMessages } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(50);

  const initialMessages = (dbMessages || []).map((msg: Message) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: msg.content }],
    createdAt: new Date(msg.created_at),
  }));

  return (
    <ChatInterface
      initialMessages={initialMessages}
      patientName={profile.patient_name || 'your loved one'}
    />
  );
}
