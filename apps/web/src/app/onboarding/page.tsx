import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { AmbientBackground } from '@/components/AmbientBackground';
import { OnboardingShell } from '@/components/OnboardingShell';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?error=session');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt, role: users.role }).from(users).where(eq(users.email, session.user.email!)).limit(1);
  if (!dbUser) redirect('/login?error=session');

  // Social sign-up passes ?role=caregiver|patient|self in callbackUrl.
  // Save it to DB here if the user has no role yet (avoids a separate API call).
  const { role: roleParam } = await searchParams;
  if (!dbUser.role && roleParam && ['caregiver', 'patient', 'self'].includes(roleParam)) {
    await db.update(users).set({ role: roleParam }).where(eq(users.id, dbUser.id));
    dbUser.role = roleParam;
  }

  const allProfiles = await db
    .select({
      id: careProfiles.id,
      patientName: careProfiles.patientName,
      patientAge: careProfiles.patientAge,
      cancerType: careProfiles.cancerType,
      cancerStage: careProfiles.cancerStage,
      treatmentPhase: careProfiles.treatmentPhase,
      relationship: careProfiles.relationship,
      onboardingCompleted: careProfiles.onboardingCompleted,
      onboardingPriorities: careProfiles.onboardingPriorities,
    })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .orderBy(asc(careProfiles.createdAt));

  const userName = dbUser.displayName || dbUser.email.split('@')[0] || '';
  const userEmail = dbUser.email || '';
  const userAvatar = session.user.image || '';

  return (
    <div className="min-h-screen min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <AmbientBackground />
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-16">
        <OnboardingShell
          allProfiles={allProfiles}
          userName={userName}
          userEmail={userEmail}
          userAvatar={userAvatar}
          userRole={dbUser.role as 'caregiver' | 'patient' | 'self' | null | undefined}
        />
      </div>
    </div>
  );
}
