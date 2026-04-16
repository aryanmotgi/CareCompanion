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
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.cognitoSub, session.user.id))
    .limit(1)

  if (!dbUser) redirect('/login')

  const userId = dbUser.id

  const [profile, allProfiles, unreadNotifications] = await Promise.all([
    getActiveProfile(userId),
    getAllProfiles(userId),
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .limit(20),
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
