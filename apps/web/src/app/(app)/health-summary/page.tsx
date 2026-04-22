import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { HealthSummaryView } from '@/components/HealthSummaryView';

export default async function HealthSummaryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, session.user.email!)).limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db
    .select({ patientName: careProfiles.patientName })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  if (!profile) redirect('/setup');

  return <HealthSummaryView patientName={profile.patientName || 'your loved one'} />;
}
