import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles, messages } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { ChatInterface } from '@/components/ChatInterface';

async function ChatContent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, cognitoSub: users.cognitoSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.cognitoSub, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db
    .select({ id: careProfiles.id, patientName: careProfiles.patientName })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  if (!profile) redirect('/setup');

  const dbMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.userId, dbUser.id))
    .orderBy(asc(messages.createdAt))
    .limit(50);

  const initialMessages = dbMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: msg.content }],
    createdAt: msg.createdAt ?? new Date(),
  }));

  return (
    <ChatInterface
      initialMessages={initialMessages}
      patientName={profile.patientName || 'your loved one'}
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
