import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET() {
  const { user: dbUser, error } = await getAuthenticatedUser()
  if (error) return error

  const [profile] = await db.select().from(careProfiles)
    .where(eq(careProfiles.userId, dbUser!.id))
    .limit(1)

  return NextResponse.json({
    userId: dbUser!.id,
    email: dbUser!.email,
    displayName: dbUser!.displayName ?? dbUser!.email?.split('@')[0] ?? '',
    careProfileId: profile?.id ?? null,
    patientName: profile?.patientName ?? null,
    emergencyContactName: profile?.emergencyContactName ?? null,
    emergencyContactPhone: profile?.emergencyContactPhone ?? null,
    cancerType: profile?.cancerType ?? null,
    cancerStage: profile?.cancerStage ?? null,
    treatmentPhase: profile?.treatmentPhase ?? null,
    allergies: profile?.allergies ?? null,
    conditions: profile?.conditions ?? null,
    role: profile?.role ?? 'patient',
    caregiverForName: profile?.caregiverForName ?? null,
  })
}
