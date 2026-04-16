import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, notifications } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { AppShell } from '@/components/AppShell'
import { ToastProvider } from '@/components/ToastProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { CsrfProvider } from '@/components/CsrfProvider'
import { getActiveProfile, getAllProfiles } from '@/lib/active-profile'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // Resolve local DB user from Cognito sub
  let dbUser: typeof users.$inferSelect | undefined
  try {
    const [found] = await db
      .select()
      .from(users)
      .where(eq(users.cognitoSub, session.user.id))
      .limit(1)
    dbUser = found
  } catch (e) {
    console.error('[app/layout] DB lookup failed:', e)
    redirect('/login?error=db')
  }

  if (!dbUser) {
    // User authenticated but not in DB yet — try to insert them now
    try {
      const [inserted] = await db
        .insert(users)
        .values({
          cognitoSub: session.user.id,
          email: session.user.email ?? '',
          displayName: session.user.name || session.user.email || '',
          isDemo: false,
        })
        .onConflictDoUpdate({
          target: users.cognitoSub,
          set: { email: session.user.email ?? '', displayName: session.user.name || session.user.email || '' },
        })
        .returning()
      dbUser = inserted
    } catch (e) {
      console.error('[app/layout] DB insert failed:', e)
      redirect('/login?error=db')
    }
  }

  if (!dbUser) redirect('/login')

  const userId = dbUser.id

  const [profile, allProfiles, unreadNotifications] = await Promise.all([
    getActiveProfile(userId).catch(() => null),
    getAllProfiles(userId).catch(() => []),
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .limit(20)
      .catch(() => []),
  ])

  const unread = unreadNotifications.filter(n => !n.isRead)

  return (
    <ThemeProvider>
    <CsrfProvider>
    <ToastProvider>
      <OfflineIndicator />
      <ServiceWorkerRegistration />
      <AppShell
        patientName={profile?.patientName || 'your loved one'}
        patientAge={profile?.patientAge ?? undefined}
        relationship={profile?.relationship ?? undefined}
        userName={dbUser.displayName || session.user.email || ''}
        notifications={unread}
        profiles={allProfiles}
        activeProfileId={profile?.id || null}
        isDemo={dbUser.isDemo ?? false}
      >
        <div className="animate-page-blur-in">
          {children}
        </div>
      </AppShell>
    </ToastProvider>
    </CsrfProvider>
    </ThemeProvider>
  )
}
