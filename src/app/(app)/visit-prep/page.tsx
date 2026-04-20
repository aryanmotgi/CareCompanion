import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles, appointments } from '@/lib/db/schema';
import { eq, and, gte, lte, asc, isNull } from 'drizzle-orm';
import { VisitPrepView } from '@/components/VisitPrepView';
import { SkeletonCard } from '@/components/SkeletonCard';

export const metadata = {
  title: 'Visit Prep — CareCompanion',
};

function VisitPrepSkeleton() {
  return (
    <div className="space-y-4 px-5 py-4">
      <div className="space-y-2">
        <div className="h-6 w-40 skeleton-bone" />
        <div className="h-3 w-56 skeleton-bone" style={{ animationDelay: '0.1s' }} />
      </div>
      <SkeletonCard />
      <SkeletonCard variant="wide" />
      <SkeletonCard />
    </div>
  );
}

async function VisitPrepData() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, cognitoSub: users.cognitoSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.cognitoSub, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  if (!profile) redirect('/setup');

  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const appts = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.careProfileId, profile.id),
        isNull(appointments.deletedAt),
        gte(appointments.dateTime, now),
        lte(appointments.dateTime, thirtyDaysOut),
      )
    )
    .orderBy(asc(appointments.dateTime));

  return <VisitPrepView appointments={appts} />;
}

export default function VisitPrepPage() {
  return (
    <div className="max-w-3xl">
      <Suspense fallback={<VisitPrepSkeleton />}>
        <VisitPrepData />
      </Suspense>
    </div>
  );
}
