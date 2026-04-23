import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, notifications, careProfiles } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { AppShell } from '@/components/AppShell'
import { ToastProvider } from '@/components/ToastProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { TestModeBanner } from '@/components/TestModeBanner'
import { ChecklistVersionNotice } from '@/components/ChecklistVersionNotice'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { CsrfProvider } from '@/components/CsrfProvider'
import { SessionProvider } from '@/components/providers/SessionProvider'
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
  if (!session?.user?.id) redirect('/login?error=session')

  // Resolve local DB user by email (stable across provider changes)
  const userEmail = session.user.email ?? ''
  let dbUser: typeof users.$inferSelect | undefined
  try {
    const [found] = await db
      .select({
        id: users.id,
        providerSub: users.providerSub,
        email: users.email,
        displayName: users.displayName,
        isDemo: users.isDemo,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1)
    dbUser = found as typeof users.$inferSelect
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const cause = (e as Error & { cause?: unknown })?.cause
    const causeMsg = cause instanceof Error ? cause.message : (cause ? JSON.stringify(cause) : '')
    const fullMsg = msg + (causeMsg ? ' | cause: ' + causeMsg : '')
    console.error('[app/layout] DB lookup failed:', fullMsg, e)
    const encoded = encodeURIComponent(fullMsg.slice(0, 1000))
    redirect(`/login?error=db&detail=${encoded}`)
  }

  if (!dbUser) {
    // With credentials-only auth, users must exist in DB before they can authenticate
    // (authorize() requires a matching email + passwordHash). If we get here, something
    // is wrong — redirect to login.
    redirect('/login?error=user_not_found')
  }

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
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .limit(20)
      .catch(() => []),
  ])

  const unread = unreadNotifications

  return (
    <SessionProvider>
    <ThemeProvider>
    <CsrfProvider>
    <ToastProvider>
      <OfflineIndicator />
      <TestModeBanner />
      <ChecklistVersionNotice />
      <ServiceWorkerRegistration />
      <AppShell
        patientName={profile?.patientName || 'your loved one'}
        patientAge={profile?.patientAge ?? undefined}
        relationship={profile?.relationship ?? undefined}
        userName={dbUser.displayName || session.user.name || ''}
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
    </SessionProvider>
  )
}
