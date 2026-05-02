import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { careGroupInvites, careGroupMembers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'

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

  // Check not already a member
  const existing = await db.query.careGroupMembers.findFirst({
    where: and(
      eq(careGroupMembers.careGroupId, invite.careGroupId),
      eq(careGroupMembers.userId, session.user.id),
    ),
  })

  if (!existing) {
    await db.insert(careGroupMembers).values({
      careGroupId: invite.careGroupId,
      userId: session.user.id,
      role: 'member',
    })
    await db.update(careGroupInvites)
      .set({ usedBy: session.user.id })
      .where(eq(careGroupInvites.id, invite.id))
  }

  redirect('/onboarding?careGroupId=' + careGroupId + '&joined=true')
}
