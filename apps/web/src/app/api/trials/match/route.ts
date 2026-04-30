import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { assembleProfile } from '@/lib/trials/assembleProfile'
import { runTrialsAgent } from '@/lib/trials/clinicalTrialsAgent'
import { db } from '@/lib/db'
import { careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  const { user, error } = await getAuthenticatedUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile] = await db.select({ id: careProfiles.id })
    .from(careProfiles).where(eq(careProfiles.userId, user.id)).limit(1)
  if (!profile) return NextResponse.json({ error: 'No care profile found' }, { status: 404 })

  const patientProfile = await assembleProfile(profile.id)
  const { matched, close } = await runTrialsAgent(patientProfile)

  return NextResponse.json({ matched, close })
}
