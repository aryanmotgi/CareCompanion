import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { careProfiles, users, careGroupMembers, careGroups } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail, onboardingRecapEmailHtml } from '@/lib/email'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { careProfileId } = await req.json()
  if (!careProfileId) return NextResponse.json({ error: 'careProfileId required' }, { status: 400 })

  // Mark onboarding as completed
  await db.update(careProfiles)
    .set({ onboardingCompleted: true })
    .where(eq(careProfiles.id, careProfileId))

  // Send recap email — non-blocking
  try {
    const profile = await db.query.careProfiles.findFirst({ where: eq(careProfiles.id, careProfileId) })
    const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })

    // Fetch care group name
    const membership = await db.query.careGroupMembers.findFirst({
      where: eq(careGroupMembers.userId, session.user.id),
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
