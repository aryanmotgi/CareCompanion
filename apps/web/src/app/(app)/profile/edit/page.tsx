import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation'
import { db } from '@/lib/db';
import { users, careProfiles, medications, doctors, appointments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ProfileEditor } from '@/components/ProfileEditor'

export default async function ProfileEditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

  const [profile] = await db.select().from(careProfiles).where(eq(careProfiles.userId, dbUser.id)).limit(1);
  if (!profile) redirect('/setup');

  const [meds, docs, appts] = await Promise.all([
    db.select().from(medications).where(eq(medications.careProfileId, profile.id)),
    db.select().from(doctors).where(eq(doctors.careProfileId, profile.id)),
    db.select().from(appointments).where(eq(appointments.careProfileId, profile.id)),
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
