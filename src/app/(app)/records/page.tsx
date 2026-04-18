import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation'
import { db } from '@/lib/db';
import { users, careProfiles, medications, appointments, labResults, documents } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { Medication, Appointment, LabResult, Document } from '@/lib/types'

const RecordsView = dynamic(() => import('@/components/RecordsView').then(m => m.RecordsView))

export const metadata = {
  title: 'Health Records — CareCompanion',
}

async function RecordsContent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, cognitoSub: users.cognitoSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.cognitoSub, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db
    .select({ id: careProfiles.id, conditions: careProfiles.conditions, allergies: careProfiles.allergies })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  const [meds, appts, labs, docs] = await Promise.all([
    profile
      ? db.select().from(medications).where(eq(medications.careProfileId, profile.id)).orderBy(desc(medications.createdAt))
      : Promise.resolve([] as Medication[]),
    profile
      ? db.select().from(appointments).where(eq(appointments.careProfileId, profile.id)).orderBy(desc(appointments.dateTime))
      : Promise.resolve([] as Appointment[]),
    db.select().from(labResults).where(eq(labResults.userId, dbUser.id)).orderBy(desc(labResults.dateTaken)),
    profile
      ? db.select().from(documents).where(eq(documents.careProfileId, profile.id)).orderBy(desc(documents.documentDate))
      : Promise.resolve([] as Document[]),
  ]);

  return (
    <RecordsView
      medications={meds as Medication[]}
      appointments={appts as Appointment[]}
      labResults={labs as LabResult[]}
      documents={docs as Document[]}
      conditions={profile?.conditions || null}
      allergies={profile?.allergies || null}
    />
  )
}

function RecordsSkeleton() {
  return (
    <div className="px-5 py-6 space-y-4 animate-pulse">
      <div className="h-7 bg-white/[0.06] rounded-lg w-40" />
      <div className="h-4 bg-white/[0.04] rounded w-56" />
      <div className="h-20 bg-white/[0.04] rounded-2xl border border-white/[0.06]" />
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-8 bg-white/[0.06] rounded-full w-24" />
        ))}
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 bg-white/[0.04] rounded-2xl border border-white/[0.06]" />
      ))}
    </div>
  )
}

export default function RecordsPage() {
  return (
    <Suspense fallback={<RecordsSkeleton />}>
      <RecordsContent />
    </Suspense>
  )
}
