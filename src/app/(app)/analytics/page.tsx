import dynamic from 'next/dynamic';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, labResults, symptomEntries, reminderLogs, medications, claims } from '@/lib/db/schema';
import { eq, and, gte, asc, desc, isNull } from 'drizzle-orm';
import { getActiveProfile } from '@/lib/active-profile';

const AnalyticsDashboard = dynamic(() => import('@/components/AnalyticsDashboard').then(m => m.AnalyticsDashboard));

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, cognitoSub: users.cognitoSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.cognitoSub, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

  const profile = await getActiveProfile(dbUser.id);
  if (!profile) redirect('/setup');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoDate = thirtyDaysAgo.toISOString().split('T')[0];

  const [labs, symptoms, logs, meds, claimsData] = await Promise.all([
    db.select().from(labResults).where(eq(labResults.userId, dbUser.id)).orderBy(asc(labResults.dateTaken)),
    db.select().from(symptomEntries)
      .where(eq(symptomEntries.userId, dbUser.id))
      .orderBy(asc(symptomEntries.date)),
    db.select().from(reminderLogs)
      .where(and(eq(reminderLogs.userId, dbUser.id), gte(reminderLogs.createdAt, thirtyDaysAgo)))
      .orderBy(asc(reminderLogs.createdAt)),
    db.select().from(medications).where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt))),
    db.select().from(claims).where(eq(claims.userId, dbUser.id)).orderBy(desc(claims.createdAt)).limit(20),
  ]);

  const filteredSymptoms = symptoms.filter(s => s.date && s.date >= thirtyDaysAgoDate);

  return (
    <AnalyticsDashboard
      patientName={profile.patientName || 'your loved one'}
      labResults={labs}
      symptoms={filteredSymptoms}
      reminderLogs={logs}
      medications={meds}
      claims={claimsData}
    />
  );
}
