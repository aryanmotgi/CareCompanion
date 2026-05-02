import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation'
import { db } from '@/lib/db';
import { users, careProfiles, medications, doctors, appointments } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { ProfileEditor } from '@/components/ProfileEditor'

export default async function ProfileEditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?error=session');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, session.user.email!)).limit(1);
  if (!dbUser) redirect('/login?error=session');

  const [profile] = await db.select().from(careProfiles).where(eq(careProfiles.userId, dbUser.id)).limit(1);
  if (!profile) redirect('/setup');

  const [meds, docs, appts] = await Promise.all([
    db.select().from(medications).where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt))).catch(() => []),
    db.select().from(doctors).where(and(eq(doctors.careProfileId, profile.id), isNull(doctors.deletedAt))).catch(() => []),
    db.select().from(appointments).where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt))).catch(() => []),
  ]);

  return (
    <div className="max-w-3xl">
      <ProfileEditor
        profile={profile}
        medications={meds}
        doctors={docs}
        appointments={appts}
      />
    </div>
  )
}
