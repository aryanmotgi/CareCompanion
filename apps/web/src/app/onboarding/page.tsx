import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles, careGroupMembers } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { AmbientBackground } from '@/components/AmbientBackground';
import { OnboardingShell } from '@/components/OnboardingShell';

const INVITE_ERROR_MESSAGES: Record<string, string> = {
  'invite-not-found': 'That invite link isn\'t valid. Ask your care partner to share a new one.',
  'invite-used': 'This invite has already been used. Ask your care partner to generate a fresh link.',
  'invite-revoked': 'This invite has been cancelled. Ask your care partner to share a new one.',
  'invite-expired': 'This invite expired. Ask your care partner to share a new one — they only last 7 days.',
  'group-full': 'This Care Group is full (maximum 10 members). Ask your care partner to reach out to us for help.',
  'invalid-invite': 'That invite link looks incomplete. Try opening it again from the original message.',
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; careGroupId?: string; joined?: string; error?: string }>
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?error=session');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt, role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!dbUser) redirect('/login?error=session');

  // Social sign-up passes ?role=caregiver|patient|self in callbackUrl.
  // Save it to DB here if the user has no role yet (avoids a separate API call).
  const { role: roleParam, careGroupId: joinedCareGroupId, error: errorParam } = await searchParams;
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

  // If user arrived via QR join (?careGroupId=X&joined=true), they're already in the
  // care_group_members table. Pass the group id so OnboardingShell skips the care-group
  // phase instead of presenting it again.
  // Also check DB directly in case the URL param is missing but they're already a member.
  let resolvedCareGroupId = joinedCareGroupId ?? undefined;
  if (!resolvedCareGroupId) {
    const membership = await db.query.careGroupMembers.findFirst({
      where: eq(careGroupMembers.userId, dbUser.id),
      columns: { careGroupId: true },
    });
    if (membership) resolvedCareGroupId = membership.careGroupId;
  }

  const inviteErrorMessage = errorParam ? (INVITE_ERROR_MESSAGES[errorParam] ?? null) : null;

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
          initialCareGroupId={resolvedCareGroupId}
          inviteError={inviteErrorMessage ?? undefined}
        />
      </div>
    </div>
  );
}
