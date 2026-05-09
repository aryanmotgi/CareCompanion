import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { careGroupInvites, careGroupMembers } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { auth } from '@/lib/auth'

const MAX_MEMBERS = 10

// Next.js 15+: searchParams is a Promise — must be awaited
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; token?: string }>
}) {
  const { group: careGroupId, token } = await searchParams

  if (!careGroupId || !token) {
    redirect('/signup?error=invalid-invite')
  }

  // If not logged in, redirect to signup with the invite params preserved
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/signup?joinGroup=${careGroupId}&joinToken=${token}`)
  }

  // Validate the invite token
  const invite = await db.query.careGroupInvites.findFirst({
    where: eq(careGroupInvites.token, token),
  })

  if (!invite) {
    redirect('/onboarding?error=invite-not-found')
  }
  // Verify the invite belongs to the group in the URL — prevents joining an arbitrary
  // group by crafting a URL with a valid token from a different group.
  if (invite.careGroupId !== careGroupId) {
    redirect('/onboarding?error=invite-not-found')
  }
  if (invite.usedBy) {
    redirect('/onboarding?error=invite-used')
  }
  if (invite.revokedAt) {
    redirect('/onboarding?error=invite-revoked')
  }
  if (invite.expiresAt < new Date()) {
    redirect('/onboarding?error=invite-expired')
  }

  // Wrap membership check, limit check, insert, and invite mark-as-used in a single
  // transaction so concurrent requests from the same user cannot double-join and so
  // the invite is never left in an inconsistent "used but member not inserted" state.
  // Use a plain object so TypeScript does not narrow the let binding to its literal initial value
  const outcome = { value: 'joined' as 'already_member' | 'group_full' | 'joined' }
  await db.transaction(async (tx) => {
    const existing = await tx.query.careGroupMembers.findFirst({
      where: and(
        eq(careGroupMembers.careGroupId, invite.careGroupId),
        eq(careGroupMembers.userId, session.user.id),
      ),
    })

    if (existing) {
      outcome.value = 'already_member'
      return
    }

    const [{ value: memberCount }] = await tx
      .select({ value: count() })
      .from(careGroupMembers)
      .where(eq(careGroupMembers.careGroupId, invite.careGroupId))

    if (memberCount >= MAX_MEMBERS) {
      outcome.value = 'group_full'
      return
    }

    await tx.insert(careGroupMembers).values({
      careGroupId: invite.careGroupId,
      userId: session.user.id,
      role: 'member',
    })
    await tx.update(careGroupInvites)
      .set({ usedBy: session.user.id })
      .where(eq(careGroupInvites.id, invite.id))
  })

  if (outcome.value === 'group_full') {
    redirect('/onboarding?error=group-full')
  }

  redirect('/onboarding?careGroupId=' + careGroupId + '&joined=true')
}
