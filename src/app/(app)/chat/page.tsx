import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChatInterface } from '@/components/ChatInterface';
import type { Message } from '@/lib/types';

async function ChatContent() {
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

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100dvh-140px)]">
        <div className="flex gap-1.5">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
