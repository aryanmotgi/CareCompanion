import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation'
import { db } from '@/lib/db';
import { users, notifications } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { NotificationsView } from '@/components/NotificationsView'

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [dbUser] = await db.select({ id: users.id, providerSub: users.providerSub, email: users.email, displayName: users.displayName, isDemo: users.isDemo, createdAt: users.createdAt }).from(users).where(eq(users.providerSub, session.user.id)).limit(1);
  if (!dbUser) redirect('/login');

  const notifs = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, dbUser.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);

  return <NotificationsView notifications={notifs} />
}
