import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, medications, appointments } from '@/lib/db/schema';
import { and, eq, asc, isNull } from 'drizzle-orm';
import { getActiveProfile } from '@/lib/active-profile';
import { CalendarView } from '@/components/CalendarView';

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, session.user.email!)).limit(1);
  if (!dbUser) redirect('/login');

  const profile = await getActiveProfile(dbUser.id);
  if (!profile) redirect('/setup');

  const [appts, meds] = await Promise.all([
    db.select().from(appointments).where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt))).orderBy(asc(appointments.dateTime)),
    db
      .select({ name: medications.name, refillDate: medications.refillDate })
      .from(medications)
      .where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt))),
  ]);

  const medsWithRefill = meds.filter(m => m.refillDate !== null);

  return (
    <CalendarView
      appointments={appts}
      medications={medsWithRefill}
      patientName={profile.patientName || 'your loved one'}
    />
  );
}
