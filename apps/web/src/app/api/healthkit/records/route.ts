import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { conditions, allergies, procedures, immunizations, careProfiles } from '@/lib/db/schema'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { getAuthenticatedUser } from '@/lib/api-helpers'

export async function GET() {
  const { user, error: authError } = await getAuthenticatedUser()
  if (authError) return authError

  const careProfile = await db.query.careProfiles.findFirst({
    where: eq(careProfiles.userId, user.id),
  })
  if (!careProfile) {
    return NextResponse.json({ conditions: [], allergies: [], procedures: [], immunizations: [] })
  }

  const [cond, allg, proc, imm] = await Promise.all([
    db.select().from(conditions)
      .where(and(eq(conditions.careProfileId, careProfile.id), isNull(conditions.deletedAt)))
      .orderBy(desc(conditions.onsetDateTime)),
    db.select().from(allergies)
      .where(and(eq(allergies.careProfileId, careProfile.id), isNull(allergies.deletedAt))),
    db.select().from(procedures)
      .where(and(eq(procedures.careProfileId, careProfile.id), isNull(procedures.deletedAt)))
      .orderBy(desc(procedures.performedDateTime)),
    db.select().from(immunizations)
      .where(and(eq(immunizations.careProfileId, careProfile.id), isNull(immunizations.deletedAt)))
      .orderBy(desc(immunizations.occurrenceDateTime)),
  ])

  return NextResponse.json({
    conditions: cond,
    allergies: allg,
    procedures: proc,
    immunizations: imm,
  })
}
