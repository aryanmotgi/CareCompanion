import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { careProfiles, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { triggerMatchingRun } from '@/lib/trials/matchingQueue'

// GET — fetch a specific care profile (must belong to the current user)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, session.user.email!)).limit(1)
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const profile = await db.query.careProfiles.findFirst({
    where: and(eq(careProfiles.id, id), eq(careProfiles.userId, dbUser.id)),
  })

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(profile)
}

// PATCH — update care profile fields (camelCase, as sent by wizard components)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, session.user.email!)).limit(1)
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Verify ownership
  const existing = await db.query.careProfiles.findFirst({
    where: and(eq(careProfiles.id, id), eq(careProfiles.userId, dbUser.id)),
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Accept camelCase fields from wizard components
  const allowed: Record<string, unknown> = {}
  if (body.patientName !== undefined) allowed.patientName = body.patientName
  if (body.patientAge !== undefined) allowed.patientAge = body.patientAge
  if (body.relationship !== undefined) allowed.relationship = body.relationship
  if (body.cancerType !== undefined) allowed.cancerType = body.cancerType
  if (body.cancerStage !== undefined) allowed.cancerStage = body.cancerStage
  if (body.treatmentPhase !== undefined) allowed.treatmentPhase = body.treatmentPhase
  if (body.conditions !== undefined) allowed.conditions = body.conditions
  if (body.allergies !== undefined) allowed.allergies = body.allergies
  if (body.onboardingCompleted !== undefined) allowed.onboardingCompleted = body.onboardingCompleted
  if (body.onboardingPriorities !== undefined) allowed.onboardingPriorities = body.onboardingPriorities
  // v0.2.0.0 columns
  if (body.caregivingExperience !== undefined) allowed.caregivingExperience = body.caregivingExperience
  if (body.primaryConcern !== undefined) allowed.primaryConcern = body.primaryConcern
  if (body.fieldOverrides !== undefined) allowed.fieldOverrides = body.fieldOverrides
  if (body.zipCode !== undefined) allowed.zipCode = body.zipCode
  if (body.city !== undefined) allowed.city = body.city
  if (body.state !== undefined) allowed.state = body.state

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const [updated] = await db.update(careProfiles)
    .set(allowed)
    .where(and(eq(careProfiles.id, id), eq(careProfiles.userId, dbUser.id)))
    .returning({ id: careProfiles.id })

  void triggerMatchingRun(updated.id, 'profile_update')

  return NextResponse.json({ id: updated.id })
}
