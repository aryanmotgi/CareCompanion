import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, careProfiles, symptomEntries } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { SymptomJournal } from '@/components/SymptomJournal';

export default async function JournalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db
    .select({ id: careProfiles.id, patientName: careProfiles.patientName })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser.id))
    .limit(1);

  if (!profile) redirect('/setup');

  // Fetch last 14 days of entries
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const entries = await db
    .select()
    .from(symptomEntries)
    .where(eq(symptomEntries.userId, dbUser.id))
    .orderBy(desc(symptomEntries.date));

  const filteredEntries = entries.filter(e => e.date && e.date >= since);

  return (
    <SymptomJournal
      patientName={profile.patientName || 'your loved one'}
      initialEntries={filteredEntries}
    />
  );
}
