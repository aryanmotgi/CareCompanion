import { Suspense } from 'react'
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation'
import { db } from '@/lib/db';
import { users, careProfiles, doctors, labResults } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { ProfileDashboard } from '@/components/ProfileDashboard'
import { ProfileSkeleton } from '@/components/skeletons/ProfileSkeleton'

async function ProfileContent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, session.user.email!)).limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db.select().from(careProfiles).where(eq(careProfiles.userId, dbUser.id)).limit(1);
  if (!profile) redirect('/setup');

  const [docs, labs] = await Promise.all([
    db.select().from(doctors).where(eq(doctors.careProfileId, profile.id)).catch(() => []),
    db.select().from(labResults).where(eq(labResults.userId, dbUser.id)).orderBy(desc(labResults.dateTaken)).limit(50).catch(() => []),
  ]);

  return (
    <ProfileDashboard
      profile={profile}
      doctors={docs}
      labResults={labs}
    />
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  )
}
