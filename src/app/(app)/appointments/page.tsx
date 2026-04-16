import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles, appointments } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { AppointmentsView } from '@/components/AppointmentsView';

export default async function AppointmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select().from(users).where(eq(users.cognitoSub, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  if (!profile) redirect('/setup');

  const appts = await db
    .select()
    .from(appointments)
    .where(eq(appointments.careProfileId, profile.id))
    .orderBy(asc(appointments.dateTime));

  return (
    <div className="max-w-3xl">
      <AppointmentsView appointments={appts} profileId={profile.id} />
    </div>
  );
}
