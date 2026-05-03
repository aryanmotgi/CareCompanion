import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles, appointments } from '@/lib/db/schema';
import { and, eq, asc, isNull } from 'drizzle-orm';
import { AppointmentsView } from '@/components/AppointmentsView';

export default async function AppointmentsPage() {
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

  const appts = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt)))
    .orderBy(asc(appointments.dateTime));

  return (
    <div className="max-w-3xl">
      <AppointmentsView
        appointments={appts}
        profileId={profile.id}
        patientName={profile.patientName ?? 'your loved one'}
      />
    </div>
  );
}
