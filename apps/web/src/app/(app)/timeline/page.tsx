import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles, medications, appointments, labResults, symptomEntries } from '@/lib/db/schema';
import { and, eq, desc, isNull } from 'drizzle-orm';
import { TreatmentTimeline } from '@/components/TreatmentTimeline';
import type { Medication, Appointment, LabResult, SymptomEntry } from '@/lib/types';

export const metadata = {
  title: 'Treatment Timeline | CareCompanion',
  description: 'Your complete care journey in one view',
};

function TimelineLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-48 rounded-lg bg-white/[0.06] animate-pulse" />
        <div className="h-4 w-64 rounded-lg bg-white/[0.04] animate-pulse mt-2" />
      </div>
      <div className="flex gap-2 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-white/[0.06] animate-pulse" />
        ))}
      </div>
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="w-3 h-3 rounded-full bg-white/[0.08] animate-pulse mt-1.5 shrink-0" />
            <div className="flex-1 h-24 rounded-2xl bg-white/[0.04] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function TimelineData() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, session.user.email!)).limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  if (!profile) redirect('/setup');

  const [meds, appts, labs, symptoms] = await Promise.all([
    db.select().from(medications).where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt))).orderBy(desc(medications.createdAt)),
    db.select().from(appointments).where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt))).orderBy(desc(appointments.dateTime)),
    db.select().from(labResults).where(eq(labResults.userId, dbUser.id)).orderBy(desc(labResults.dateTaken)),
    db.select().from(symptomEntries).where(eq(symptomEntries.userId, dbUser.id)).orderBy(desc(symptomEntries.date)),
  ]);

  return (
    <TreatmentTimeline
      medications={meds as Medication[]}
      appointments={appts as Appointment[]}
      labResults={labs as LabResult[]}
      symptomEntries={symptoms as SymptomEntry[]}
    />
  );
}

export default function TimelinePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Suspense fallback={<TimelineLoading />}>
        <TimelineData />
      </Suspense>
    </div>
  );
}
