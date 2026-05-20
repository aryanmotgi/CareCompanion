import { Suspense } from 'react'
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, medications, appointments, labResults, claims, reminderLogs, scannedDocuments, doctors, treatmentCycles } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, asc, count, isNull } from 'drizzle-orm';
import { DashboardView } from '@/components/DashboardView';
import { SelfCareDashboardView } from '@/components/SelfCareDashboardView';
import { CaregiverDashboardView } from '@/components/CaregiverDashboardView';
import { getActiveProfile } from '@/lib/active-profile';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { MedicationReminders } from '@/components/MedicationReminders';
import { DashboardInsights } from '@/components/DashboardInsights';
import { OnboardingWelcomeBanner } from '@/components/OnboardingWelcomeBanner';
import { NadirBanner } from '@/components/NadirBanner';
import { ShareHealthCard } from '@/components/ShareHealthCard';
import { TrialsDashboardCard } from '@/components/trials/TrialsDashboardCard';

async function DashboardContent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?error=session');

  const userEmail = session.user.email
  if (!userEmail) redirect('/login?error=session');

  const role = (session.user as { role?: string }).role ?? null;

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, userEmail)).limit(1);
  if (!dbUser) redirect('/login?error=session');

  const profile = await getActiveProfile(dbUser.id);
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
    activeCycleRows,
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
    db.select({
      cycleId: treatmentCycles.id,
      cycleNumber: treatmentCycles.cycleNumber,
      startDate: treatmentCycles.startDate,
      cycleLengthDays: treatmentCycles.cycleLengthDays,
    }).from(treatmentCycles).where(and(eq(treatmentCycles.careProfileId, profile.id), eq(treatmentCycles.isActive, true))).limit(1).catch(() => [] as { cycleId: string; cycleNumber: number; startDate: string; cycleLengthDays: number }[]),
  ]);

  const [scannedDocCount] = scannedDocRows;
  const [doctorCount] = doctorRows;

  // Compute current day of active treatment cycle for the nadir banner.
  // Day 1 is the start date itself. Banner self-gates to days 7–14.
  let nadirCycle: { dayOfCycle: number; cycleNumber: number; cycleId: string } | null = null;
  const [activeCycle] = activeCycleRows;
  if (activeCycle) {
    const startMs = new Date(activeCycle.startDate + 'T00:00:00').getTime();
    const todayMs = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const dayOfCycle = Math.floor((todayMs - startMs) / 86400000) + 1;
    if (dayOfCycle >= 7 && dayOfCycle <= 14 && dayOfCycle <= activeCycle.cycleLengthDays) {
      nadirCycle = { dayOfCycle, cycleNumber: activeCycle.cycleNumber, cycleId: activeCycle.cycleId };
    }
  }

  const hasEmergencyContact = !!(profile.emergencyContactName && profile.emergencyContactPhone);
  const hasDocumentsScanned = (scannedDocCount?.value ?? 0) > 0;

  const patientName = profile.patientName || 'your loved one';

  if (role === 'caregiver') {
    return (
      <>
        {nadirCycle && <NadirBanner dayOfCycle={nadirCycle.dayOfCycle} cycleNumber={nadirCycle.cycleNumber} cycleId={nadirCycle.cycleId} />}
        <OnboardingWelcomeBanner />
        <CaregiverDashboardView
          patientName={patientName}
          medications={meds}
          appointments={appts}
          labResults={labs}
          reminderLogs={reminderLogsData}
          cancerType={profile.cancerType ?? null}
          cancerStage={profile.cancerStage ?? null}
          treatmentPhase={profile.treatmentPhase ?? null}
          emergencyContactName={profile.emergencyContactName ?? null}
          emergencyContactPhone={profile.emergencyContactPhone ?? null}
          profileId={profile.id}
        />
      </>
    )
  }

  if (role === 'self') {
    return (
      <>
        {nadirCycle && <NadirBanner dayOfCycle={nadirCycle.dayOfCycle} cycleNumber={nadirCycle.cycleNumber} cycleId={nadirCycle.cycleId} />}
        <OnboardingWelcomeBanner />
        {reminderLogsData.length > 0 && (
          <div className="px-4 sm:px-5 pt-5 sm:pt-6">
            <MedicationReminders reminders={reminderLogsData} />
          </div>
        )}
        <SelfCareDashboardView
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
          moodCheckIn={profile.moodCheckIn ?? null}
          supportStyle={profile.supportStyle ?? null}
          shareHealthCard={
            profile?.cancerType && (meds.length > 0 || appts.length > 0 || labs.length > 0)
              ? <ShareHealthCard />
              : null
          }
          insightsContent={
            <>
              <DashboardInsights />
              <TrialsDashboardCard />
            </>
          }
        />
      </>
    )
  }

  return (
    <>
      {nadirCycle && <NadirBanner dayOfCycle={nadirCycle.dayOfCycle} cycleNumber={nadirCycle.cycleNumber} cycleId={nadirCycle.cycleId} />}
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
        shareHealthCard={
          profile?.cancerType && (meds.length > 0 || appts.length > 0 || labs.length > 0)
            ? <ShareHealthCard />
            : null
        }
        insightsContent={
          <>
            <DashboardInsights />
            <TrialsDashboardCard />
          </>
        }
      />
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
