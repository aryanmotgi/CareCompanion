import { Suspense } from 'react'
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation'
import { db } from '@/lib/db';
import { users, careProfiles, medications, appointments, doctors, careTeamMembers, reminderLogs } from '@/lib/db/schema';
import { eq, and, gte, asc, isNull } from 'drizzle-orm';
import { getAllProfiles } from '@/lib/active-profile'
import { CareView } from '@/components/CareView'
import { CareSkeleton } from '@/components/skeletons/CareSkeleton'
import { ComplianceReport } from '@/components/ComplianceReport'
import { AdherenceCalendar } from '@/components/AdherenceCalendar'
import { TreatmentCycleTracker } from '@/components/TreatmentCycleTracker'
import { CaregiverBurnoutCard } from '@/components/CaregiverBurnoutCard'

async function CareContent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, session.user.email!)).limit(1);
  if (!dbUser) redirect('/login?error=session');

  const [profile] = await db
    .select({ id: careProfiles.id, patientName: careProfiles.patientName })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  if (!profile) redirect('/setup');

  const allProfiles = await getAllProfiles(dbUser.id);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [meds, appts, docs, teamMembers, todayLogs] = await Promise.all([
    db.select().from(medications).where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt))).catch(() => [] as typeof medications.$inferSelect[]),
    db.select().from(appointments).where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt))).orderBy(asc(appointments.dateTime)).catch(() => [] as typeof appointments.$inferSelect[]),
    db.select().from(doctors).where(and(eq(doctors.careProfileId, profile.id), isNull(doctors.deletedAt))).catch(() => [] as typeof doctors.$inferSelect[]),
    db.select().from(careTeamMembers).where(eq(careTeamMembers.careProfileId, profile.id)).catch(() => [] as typeof careTeamMembers.$inferSelect[]),
    db.select().from(reminderLogs).where(
      and(eq(reminderLogs.userId, dbUser.id), gte(reminderLogs.scheduledTime, todayStart))
    ).orderBy(asc(reminderLogs.scheduledTime)).catch(() => [] as typeof reminderLogs.$inferSelect[]),
  ]);

  return (
    <>
      <div className="px-4 sm:px-5 pt-5">
        <TreatmentCycleTracker
          medications={meds}
          patientName={profile.patientName || 'Patient'}
        />
      </div>
      <CareView
        profileId={profile.id}
        medications={meds}
        appointments={appts}
        doctors={docs}
        allProfiles={allProfiles}
        careTeamMembers={teamMembers}
        todayReminders={todayLogs}
      />
      <div className="px-4 sm:px-5 pb-6 space-y-5">
        <AdherenceCalendar />
        <ComplianceReport />
        <CaregiverBurnoutCard />
      </div>
    </>
  )
}

export default function CarePage() {
  return (
    <Suspense fallback={<CareSkeleton />}>
      <CareContent />
    </Suspense>
  )
}
