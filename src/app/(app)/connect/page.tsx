// Note: This page is also accessible from Settings > Connected Accounts.
// It works as a standalone page and is linked from the sidebar menu and settings.
import dynamic from 'next/dynamic';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, connectedApps, careProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const ConnectAccounts = dynamic(() => import('@/components/ConnectAccounts').then(m => m.ConnectAccounts));

export default async function ConnectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, cognitoSub: users.cognitoSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.cognitoSub, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

  const [apps, profiles] = await Promise.all([
    db.select().from(connectedApps).where(eq(connectedApps.userId, dbUser.id)),
    db.select({ patientName: careProfiles.patientName }).from(careProfiles).where(eq(careProfiles.userId, dbUser.id)).limit(1),
  ]);

  const profile = profiles[0] ?? null;

  return (
    <ConnectAccounts
      connectedApps={apps}
      patientName={profile?.patientName}
      hasProfile={!!profile}
    />
  );
}
