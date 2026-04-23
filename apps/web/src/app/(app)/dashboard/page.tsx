import { Suspense } from 'react'
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles, medications, appointments, labResults, claims, reminderLogs, scannedDocuments, doctors } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, asc, count, isNull } from 'drizzle-orm';
import { DashboardView } from '@/components/DashboardView';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { MedicationReminders } from '@/components/MedicationReminders';
import { DashboardInsights } from '@/components/DashboardInsights';
import { OnboardingWelcomeBanner } from '@/components/OnboardingWelcomeBanner';
import { ShareHealthCard } from '@/components/ShareHealthCard';

async function DashboardContent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userEmail = session.user.email
  if (!userEmail) redirect('/login?error=session');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, userEmail)).limit(1);
  if (!dbUser) redirect('/login?error=session');

  const [profile] = await db.select().from(careProfiles).where(eq(careProfiles.userId, dbUser.id)).limit(1);
  if (!profile) redirect('/onboarding');

  const onboardingComplete = profile.onboardingCompleted === true;

  // Get today's date boundaries for reminder logs
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    meds,
    appts,
    labs,
    claimsData,
    reminderLogsData,
    scannedDocRows,
    doctorRows,
  ] = await Promise.all([
    db.select().from(medications).where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt))).catch(() => [] as typeof medications.$inferSelect[]),
    db.select().from(appointments).where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt))).orderBy(asc(appointments.dateTime)).catch(() => [] as typeof appointments.$inferSelect[]),
    db.select().from(labResults).where(eq(labResults.userId, dbUser.id)).orderBy(desc(labResults.dateTaken)).limit(5).catch(() => [] as typeof labResults.$inferSelect[]),
    db.select().from(claims).where(eq(claims.userId, dbUser.id)).orderBy(desc(claims.createdAt)).limit(5).catch(() => [] as typeof claims.$inferSelect[]),
    db.select().from(reminderLogs).where(
      and(
        eq(reminderLogs.userId, dbUser.id),
        gte(reminderLogs.scheduledTime, todayStart),
        lte(reminderLogs.scheduledTime, todayEnd),
      )
    ).orderBy(asc(reminderLogs.scheduledTime)).catch(() => [] as typeof reminderLogs.$inferSelect[]),
    db.select({ value: count() }).from(scannedDocuments).where(eq(scannedDocuments.userId, dbUser.id)).catch(() => [] as { value: number }[]),
    db.select({ value: count() }).from(doctors).where(eq(doctors.careProfileId, profile.id)).catch(() => [] as { value: number }[]),
  ]);

  const [scannedDocCount] = scannedDocRows;
  const [doctorCount] = doctorRows;

  const hasEmergencyContact = !!(profile.emergencyContactName && profile.emergencyContactPhone);
  const hasDocumentsScanned = (scannedDocCount?.value ?? 0) > 0;

  const patientName = profile.patientName || 'your loved one';

  return (
    <>
      <OnboardingWelcomeBanner />
      {reminderLogsData.length > 0 && (
        <div className="px-4 sm:px-5 pt-5 sm:pt-6">
          <MedicationReminders reminders={reminderLogsData} />
        </div>
      )}
      <DashboardView
        patientName={patientName}
        userName={dbUser.displayName || session.user.name || undefined}
        medications={meds}
        appointments={appts}
        labResults={labs}
        claims={claimsData}
        cancerType={profile.cancerType || null}
        cancerStage={profile.cancerStage || null}
        treatmentPhase={profile.treatmentPhase || null}
        onboardingComplete={onboardingComplete}
        priorities={profile.onboardingPriorities || null}
        hasEmergencyContact={hasEmergencyContact}
        hasDocumentsScanned={hasDocumentsScanned}
        profileCreatedAt={profile.createdAt?.toISOString() ?? ''}
        allergies={profile.allergies || null}
        conditions={profile.conditions || null}
        emergencyContactName={profile.emergencyContactName || null}
        emergencyContactPhone={profile.emergencyContactPhone || null}
        doctorCount={doctorCount?.value ?? 0}
        profileId={profile.id}
      />
      <div className="px-4 sm:px-5 pb-6 space-y-4">
        {profile?.cancerType && (meds.length > 0 || appts.length > 0 || labs.length > 0) && <ShareHealthCard />}
        <DashboardInsights />
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
