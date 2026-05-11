import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { validateCsrf } from '@/lib/csrf'
import { db } from '@/lib/db'
import { careProfiles, careTeamMembers, pushSubscriptions } from '@/lib/db/schema'
import { sendPushNotification } from '@/lib/push'
import { eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  const { user, error } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { careProfileId, patientFirstName } = await req.json()
  if (!careProfileId) {
    return NextResponse.json({ error: 'careProfileId required' }, { status: 400 })
  }

  // Authorization: caller must be a care team member for this profile
  const [membership] = await db
    .select({ userId: careTeamMembers.userId })
    .from(careTeamMembers)
    .where(and(eq(careTeamMembers.careProfileId, careProfileId), eq(careTeamMembers.userId, user.id)))
    .limit(1)

  // Also allow the profile owner (patient self-view edge case)
  const [profile] = await db
    .select({ userId: careProfiles.userId })
    .from(careProfiles)
    .where(eq(careProfiles.id, careProfileId))
    .limit(1)

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!membership && profile.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get the patient's push subscriptions
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, profile.userId))

  if (subs.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No push subscriptions for this patient' })
  }

  const name = patientFirstName?.trim() || 'you'
  const results = await Promise.allSettled(
    subs.map((sub) =>
      sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          title: 'Check-in reminder 💙',
          body: `Your care team is thinking of ${name}. How are you feeling today?`,
          url: '/check-in',
        },
      ),
    ),
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  return NextResponse.json({ sent })
}
