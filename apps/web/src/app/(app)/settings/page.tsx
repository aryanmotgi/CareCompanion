import { Suspense } from 'react'
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation'
import { db } from '@/lib/db';
import { users, userSettings, medicationReminders, medications } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getActiveProfile } from '@/lib/active-profile'
import { SettingsPage } from '@/components/SettingsPage'
import { SettingsSkeleton } from '@/components/skeletons/SettingsSkeleton'

async function SettingsContent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?error=session');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.email, session.user.email!)).limit(1);
  if (!dbUser) redirect('/login?error=session');

  const profile = await getActiveProfile(dbUser.id);

  // Fetch or create user settings
  let [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, dbUser.id)).limit(1);

  if (!settings) {
    const [newSettings] = await db
      .insert(userSettings)
      .values({ userId: dbUser.id })
      .returning();
    settings = newSettings;
  }

  const [reminders, meds] = await Promise.all([
    db.select().from(medicationReminders).where(eq(medicationReminders.userId, dbUser.id)).orderBy(desc(medicationReminders.createdAt)).catch(() => []),
    profile
      ? db.select().from(medications).where(eq(medications.careProfileId, profile.id)).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <SettingsPage
      settings={settings}
      medicationReminders={reminders}
      medications={meds}
    />
  )
}

export default function SettingsRoute() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  )
}
