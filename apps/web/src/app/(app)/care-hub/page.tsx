import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users, careGroupMembers, careGroups } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getActiveProfile } from '@/lib/active-profile'
import CareHubView from '@/components/CareHubView'
import { Skeleton } from '@/components/Skeleton'

function CareHubLoading() {
  return (
    <div className="px-4 sm:px-5 py-5 sm:py-6">
      <Skeleton className="h-20 w-full mb-4 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full md:col-span-2" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    </div>
  )
}

async function CareHubContent() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?error=session')

  const userEmail = session.user.email
  if (!userEmail) redirect('/login?error=session')

  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, userEmail))
    .limit(1)
  if (!dbUser) redirect('/login?error=session')

  const profile = await getActiveProfile(dbUser.id)
  if (!profile) redirect('/onboarding')

  const membership = await db.query.careGroupMembers.findFirst({
    where: eq(careGroupMembers.userId, dbUser.id),
  })

  const careGroupName: string | null = membership
    ? (await db.query.careGroups.findFirst({ where: eq(careGroups.id, membership.careGroupId) }))?.name ?? null
    : null

  return (
    <CareHubView
      careProfileId={profile.id}
      patientName={profile.patientName || 'your loved one'}
      careGroupName={careGroupName}
    />
  )
}

export default function CareHubPage() {
  return (
    <Suspense fallback={<CareHubLoading />}>
      <CareHubContent />
    </Suspense>
  )
}
