import { Suspense } from 'react'
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation'
import { db } from '@/lib/db';
import { users, labResults, careProfiles } from '@/lib/db/schema';
import { and, eq, desc, isNull } from 'drizzle-orm';
import type { LabResult } from '@/lib/types'
import { LabsView } from './LabsView'

export const metadata = {
  title: 'Lab Results — CareCompanion',
}

async function LabsContent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?error=session');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, session.user.email!)).limit(1);
  if (!dbUser) redirect('/login?error=session');

  const labs = await db
    .select()
    .from(labResults)
    .where(and(eq(labResults.userId, dbUser.id), isNull(labResults.deletedAt)))
    .orderBy(desc(labResults.dateTaken));

  const [profile] = await db
    .select({ patientName: careProfiles.patientName })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1)

  return <LabsView labResults={labs as LabResult[]} patientName={profile?.patientName ?? 'your loved one'} />
}

function LabsSkeleton() {
  return (
    <div className="px-5 py-6 space-y-4 animate-pulse">
      <div className="h-7 bg-white/[0.06] rounded-lg w-32" />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-white/[0.06] rounded-full w-20" />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 bg-white/[0.04] rounded-2xl border border-white/[0.06]" />
      ))}
    </div>
  )
}

export default function LabsPage() {
  return (
    <Suspense fallback={<LabsSkeleton />}>
      <LabsContent />
    </Suspense>
  )
}
