import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiSuccess, apiError } from '@/lib/api-response'
import { db } from '@/lib/db'
import { careProfiles, medications, appointments, labResults, documents, symptomEntries } from '@/lib/db/schema'
import { and, eq, ilike, or } from 'drizzle-orm'

function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')?.trim()
    if (!query || query.length < 2) {
      return apiSuccess({ results: [] })
    }

    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, user!.id))
      .limit(1)

    const profileId = profile?.id
    const searchPattern = `%${escapeLike(query)}%`

    // Search across all data types in parallel
    const [medsData, apptsData, labsData, docsData, journalData] = await Promise.all([
      profileId
        ? db.select({ id: medications.id, name: medications.name, dose: medications.dose, frequency: medications.frequency })
            .from(medications)
            .where(and(
              eq(medications.careProfileId, profileId),
              ilike(medications.name, searchPattern),
            ))
            .limit(5)
            .catch(() => [])
        : [],
      profileId
        ? db.select({ id: appointments.id, doctorName: appointments.doctorName, specialty: appointments.specialty, dateTime: appointments.dateTime, location: appointments.location })
            .from(appointments)
            .where(and(
              eq(appointments.careProfileId, profileId),
              or(
                ilike(appointments.doctorName, searchPattern),
                ilike(appointments.specialty, searchPattern),
                ilike(appointments.location, searchPattern),
              ),
            ))
            .limit(5)
            .catch(() => [])
        : [],
      db.select({ id: labResults.id, testName: labResults.testName, value: labResults.value, unit: labResults.unit, dateTaken: labResults.dateTaken, isAbnormal: labResults.isAbnormal })
        .from(labResults)
        .where(and(
          eq(labResults.userId, user!.id),
          ilike(labResults.testName, searchPattern),
        ))
        .limit(5)
        .catch(() => []),
      profileId
        ? db.select({ id: documents.id, documentType: documents.documentType, summary: documents.summary, createdAt: documents.createdAt })
            .from(documents)
            .where(and(
              eq(documents.careProfileId, profileId),
              or(
                ilike(documents.documentType, searchPattern),
                ilike(documents.summary, searchPattern),
              ),
            ))
            .limit(5)
            .catch(() => [])
        : [],
      db.select({ id: symptomEntries.id, notes: symptomEntries.notes, symptoms: symptomEntries.symptoms, createdAt: symptomEntries.createdAt })
        .from(symptomEntries)
        .where(and(
          eq(symptomEntries.userId, user!.id),
          ilike(symptomEntries.notes, searchPattern),
        ))
        .limit(5)
        .catch(() => []),
    ])

    const results = [
      ...medsData.map((m) => ({ type: 'medication' as const, id: m.id, title: m.name, subtitle: [m.dose, m.frequency].filter(Boolean).join(' \u00b7 '), href: '/medications' })),
      ...apptsData.map((a) => ({ type: 'appointment' as const, id: a.id, title: `${a.doctorName}${a.specialty ? ` \u00b7 ${a.specialty}` : ''}`, subtitle: a.dateTime ? new Date(a.dateTime).toLocaleDateString() : a.location || '', href: '/appointments' })),
      ...labsData.map((l) => ({ type: 'lab' as const, id: l.id, title: l.testName, subtitle: `${l.value || ''}${l.unit ? ` ${l.unit}` : ''}${l.isAbnormal ? ' \u26a0\ufe0f' : ''}`, href: '/labs' })),
      ...docsData.map((d) => ({ type: 'document' as const, id: d.id, title: d.documentType || 'Document', subtitle: d.summary?.slice(0, 80) || '', href: '/scans' })),
      ...journalData.map((j) => ({ type: 'journal' as const, id: j.id, title: 'Journal Entry', subtitle: j.notes?.slice(0, 80) || (j.symptoms || []).join(', '), href: '/journal' })),
    ]

    return apiSuccess({ results, query })
  } catch (err) {
    console.error('[search] GET error:', err)
    return apiError('Internal server error', 500)
  }
}
