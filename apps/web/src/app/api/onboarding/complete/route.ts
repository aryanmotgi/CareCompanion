import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'
import { db } from '@/lib/db'
import { careProfiles, users, careGroupMembers, careGroups } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail, onboardingRecapEmailHtml } from '@/lib/email'

export async function POST(req: Request) {
  const { valid: csrfValid, error: csrfError } = await validateCsrf(req)
  if (!csrfValid) return csrfError
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { careProfileId } = await req.json()
  if (!careProfileId) return NextResponse.json({ error: 'careProfileId required' }, { status: 400 })

  // Verify the profile belongs to this user before marking complete
  // Use session.user.id (not email!) — Apple Sign-In users may have null email
  const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, session.user.id)).limit(1)
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const owned = await db.query.careProfiles.findFirst({
    where: (cp, { and, eq: deq }) => and(deq(cp.id, careProfileId), deq(cp.userId, dbUser.id)),
  })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Mark onboarding as completed
  await db.update(careProfiles)
    .set({ onboardingCompleted: true })
    .where(eq(careProfiles.id, careProfileId))

  // Send recap email — non-blocking
  try {
    const profile = owned // already fetched for ownership check above
    const user = await db.query.users.findFirst({ where: eq(users.id, dbUser.id) })

    // Fetch care group name
    const membership = await db.query.careGroupMembers.findFirst({
      where: eq(careGroupMembers.userId, dbUser.id),
    })
    let careGroupName: string | null = null
    if (membership) {
      const group = await db.query.careGroups.findFirst({
        where: eq(careGroups.id, membership.careGroupId),
      })
      careGroupName = group?.name ?? null
    }

    if (user?.email && profile) {
      const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://carecompanionai.org'}/dashboard`
      await sendEmail({
        to: user.email,
        subject: "You're all set with CareCompanion ✓",
        html: onboardingRecapEmailHtml({
          name: user.displayName ?? user.email,
          role: (user.role as 'caregiver' | 'patient' | 'self') ?? 'patient',
          cancerType: profile.cancerType,
          careGroupName,
          dashboardUrl,
        }),
      })
    }
  } catch (err) {
    console.error('[onboarding/complete] recap email failed:', err instanceof Error ? err.message : err)
  }

  return NextResponse.json({ success: true })
}
