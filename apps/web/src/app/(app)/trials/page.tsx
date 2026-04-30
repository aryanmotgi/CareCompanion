import { TrialsTab } from '@/components/trials/TrialsTab'
import { db } from '@/lib/db'
import { careProfiles } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export default async function TrialsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const [profile] = await db.select({
    id:          careProfiles.id,
    zipCode:     careProfiles.zipCode,
    patientName: careProfiles.patientName,
    cancerType:  careProfiles.cancerType,
    cancerStage: careProfiles.cancerStage,
    patientAge:  careProfiles.patientAge,
  })
    .from(careProfiles)
    .where(eq(careProfiles.userId, session.user.id as string))
    .limit(1)

  const hasZip = /^\d{5}$/.test(profile?.zipCode ?? '')

  if (!profile) redirect('/login')

  return (
    <TrialsTab
      profileId={profile.id}
      hasZip={hasZip}
      patientName={profile.patientName ?? undefined}
      cancerType={profile.cancerType ?? undefined}
      cancerStage={profile.cancerStage ?? undefined}
      patientAge={profile.patientAge ?? undefined}
    />
  )
}
