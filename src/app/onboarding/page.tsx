import dynamic from 'next/dynamic';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { AmbientBackground } from '@/components/AmbientBackground';

const OnboardingWizard = dynamic(() => import('@/components/OnboardingWizard').then(m => m.OnboardingWizard));

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select().from(users).where(eq(users.cognitoSub, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db
    .select({
      id: careProfiles.id,
      onboardingCompleted: careProfiles.onboardingCompleted,
      cancerType: careProfiles.cancerType,
      cancerStage: careProfiles.cancerStage,
      treatmentPhase: careProfiles.treatmentPhase,
      relationship: careProfiles.relationship,
      patientName: careProfiles.patientName,
      patientAge: careProfiles.patientAge,
      onboardingPriorities: careProfiles.onboardingPriorities,
    })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  const userName = dbUser.displayName || dbUser.email.split('@')[0] || '';
  const userEmail = dbUser.email || '';
  const userAvatar = session.user.image || '';

  return (
    <div className="min-h-screen min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <AmbientBackground />
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-16">
        <OnboardingWizard
          userName={userName}
          userEmail={userEmail}
          userAvatar={userAvatar}
          existingProfileId={profile?.id || null}
          existingProfile={profile || null}
        />
      </div>
    </div>
  );
}
