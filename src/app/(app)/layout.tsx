import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, notifications, careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { AppShell } from '@/components/AppShell'
import { ToastProvider } from '@/components/ToastProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { PushNotificationSetup } from '@/components/PushNotificationSetup'
import { InstallPrompt } from '@/components/InstallPrompt'
import { CsrfProvider } from '@/components/CsrfProvider'
import { getActiveProfile, getAllProfiles } from '@/lib/active-profile'

export const metadata = {
  robots: { index: false, follow: false },
}

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
    // Explicitly select only stable columns so a pending db:push (new columns not yet deployed)
    // doesn't break the entire app with "column does not exist" errors.
    const [found] = await db
      .select({
        id: users.id,
        cognitoSub: users.cognitoSub,
        email: users.email,
        displayName: users.displayName,
        isDemo: users.isDemo,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.cognitoSub, session.user.id))
      .limit(1)
    dbUser = found as typeof users.$inferSelect
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[app/layout] DB lookup failed:', msg, e)
    const encoded = encodeURIComponent(msg.slice(0, 200))
    redirect(`/login?error=db&detail=${encoded}`)
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
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[app/layout] DB insert failed:', msg, e)
      const encoded = encodeURIComponent(msg.slice(0, 200))
      redirect(`/login?error=db&detail=${encoded}`)
    }
  }

  if (!dbUser) redirect('/login')

  // HIPAA consent gate — separate query so a pending db:push (hipaaConsent column not yet deployed)
  // doesn't break login. Defaults to allowing through if column doesn't exist yet.
  let hipaaConsented = true
  try {
    const [row] = await db
      .select({ hipaaConsent: users.hipaaConsent })
      .from(users)
      .where(eq(users.id, dbUser.id))
      .limit(1)
    hipaaConsented = row?.hipaaConsent ?? false
  } catch {
    // Column not yet deployed (db:push pending) — allow through rather than breaking login
    hipaaConsented = true
  }
  if (!hipaaConsented) {
    redirect('/consent')
  }

  const userId = dbUser.id

  // Onboarding gate — redirect if user has a profile with onboardingCompleted === false
  try {
    const [activeProfile] = await db
      .select({ onboardingCompleted: careProfiles.onboardingCompleted })
      .from(careProfiles)
      .where(eq(careProfiles.userId, userId))
      .limit(1)
    if (activeProfile && activeProfile.onboardingCompleted === false) {
      redirect('/onboarding')
    }
  } catch (e) {
    // If redirect was thrown, re-throw it (Next.js redirect throws an error internally)
    if (e && typeof e === 'object' && 'digest' in e) throw e
    // Otherwise column may not exist yet — allow through
  }

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
      <PushNotificationSetup />
      <InstallPrompt />
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
