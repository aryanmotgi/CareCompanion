import { Suspense } from 'react'
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles, medications, appointments, labResults, claims, reminderLogs, connectedApps, scannedDocuments, doctors } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, asc, count } from 'drizzle-orm';
import { DashboardView } from '@/components/DashboardView';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { MedicationReminders } from '@/components/MedicationReminders';
import { DashboardInsights } from '@/components/DashboardInsights';
import { syncOneUpData } from '@/lib/oneup-sync';
import { safeDecryptToken } from '@/lib/token-encryption';

async function DashboardContent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select().from(users).where(eq(users.cognitoSub, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

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
    connectedAppsData,
    [scannedDocCount],
    [doctorCount],
  ] = await Promise.all([
    db.select().from(medications).where(eq(medications.careProfileId, profile.id)),
    db.select().from(appointments).where(eq(appointments.careProfileId, profile.id)).orderBy(asc(appointments.dateTime)),
    db.select().from(labResults).where(eq(labResults.userId, dbUser.id)).orderBy(desc(labResults.dateTaken)).limit(5),
    db.select().from(claims).where(eq(claims.userId, dbUser.id)).orderBy(desc(claims.createdAt)).limit(5),
    db.select().from(reminderLogs).where(
      and(
        eq(reminderLogs.userId, dbUser.id),
        gte(reminderLogs.scheduledTime, todayStart),
        lte(reminderLogs.scheduledTime, todayEnd),
      )
    ).orderBy(asc(reminderLogs.scheduledTime)),
    db.select().from(connectedApps).where(eq(connectedApps.userId, dbUser.id)),
    db.select({ value: count() }).from(scannedDocuments).where(eq(scannedDocuments.userId, dbUser.id)),
    db.select({ value: count() }).from(doctors).where(eq(doctors.careProfileId, profile.id)),
  ]);

  // Auto-sync: if 1upHealth is connected but profile is missing cancer info, trigger a background sync
  const oneupApp = connectedAppsData.find((a) => a.source === '1uphealth');
  const oneupTokenValid = oneupApp?.expiresAt && new Date(oneupApp.expiresAt) > new Date();
  if (oneupApp?.accessToken && oneupTokenValid && (!profile.cancerType || !profile.cancerStage)) {
    const lastSynced = oneupApp.lastSynced ? new Date(oneupApp.lastSynced).getTime() : 0;
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const accessToken = safeDecryptToken(oneupApp.accessToken);
    if (lastSynced < fiveMinAgo && accessToken && accessToken !== 'demo-token') {
      syncOneUpData(dbUser.id, accessToken).catch((err) => {
        console.error('[dashboard] Auto-sync error:', err);
      });
    }
  }

  // Only count connections with a non-expired token
  const hasHealthRecords = connectedAppsData.some(
    (a) => a.expiresAt && new Date(a.expiresAt) > new Date()
  );
  const hasEmergencyContact = !!(profile.emergencyContactName && profile.emergencyContactPhone);
  const hasDocumentsScanned = (scannedDocCount?.value ?? 0) > 0;

  const patientName = profile.patientName || 'your loved one';

  return (
    <>
      {reminderLogsData.length > 0 && (
        <div className="px-4 sm:px-5 pt-5 sm:pt-6">
          <MedicationReminders reminders={reminderLogsData} />
        </div>
      )}
      <DashboardView
        patientName={patientName}
        medications={meds}
        appointments={appts}
        labResults={labs}
        claims={claimsData}
        cancerType={profile.cancerType || null}
        cancerStage={profile.cancerStage || null}
        treatmentPhase={profile.treatmentPhase || null}
        onboardingComplete={onboardingComplete}
        priorities={profile.onboardingPriorities || null}
        hasHealthRecords={hasHealthRecords}
        hasEmergencyContact={hasEmergencyContact}
        hasDocumentsScanned={hasDocumentsScanned}
        profileCreatedAt={profile.createdAt?.toISOString() ?? ''}
        allergies={profile.allergies || null}
        conditions={profile.conditions || null}
        emergencyContactName={profile.emergencyContactName || null}
        emergencyContactPhone={profile.emergencyContactPhone || null}
        doctorCount={doctorCount?.value ?? 0}
        connectedAppCount={connectedAppsData.filter((a) => a.expiresAt && new Date(a.expiresAt) > new Date()).length}
      />
      <div className="px-4 sm:px-5 pb-6">
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
