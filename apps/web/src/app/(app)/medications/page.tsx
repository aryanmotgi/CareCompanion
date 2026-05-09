import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles, medications } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { MedicationsView } from '@/components/MedicationsView';

export default async function MedicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?error=session');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, session.user.email!)).limit(1);
  if (!dbUser) redirect('/login?error=session');

  const [profile] = await db
    .select({ id: careProfiles.id, patientName: careProfiles.patientName })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  if (!profile) redirect('/setup');

  const meds = await db
    .select()
    .from(medications)
    .where(eq(medications.careProfileId, profile.id))
    .orderBy(asc(medications.name));

  return (
    <div className="max-w-3xl">
      <MedicationsView medications={meds} profileId={profile.id} patientName={profile.patientName ?? 'your loved one'} />
    </div>
  );
}
