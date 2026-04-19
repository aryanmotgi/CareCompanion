import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { careProfiles, medications, labResults, appointments, symptomEntries } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'medications'

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser!.id))
    .limit(1)
  const profileId = profile?.id

  let rows: Record<string, unknown>[] = []
  let filename = 'export.csv'

  switch (type) {
    case 'medications': {
      const data = profileId
        ? await db
            .select({
              name: medications.name,
              dose: medications.dose,
              frequency: medications.frequency,
              prescribing_doctor: medications.prescribingDoctor,
              refill_date: medications.refillDate,
              created_at: medications.createdAt,
            })
            .from(medications)
            .where(and(eq(medications.careProfileId, profileId), isNull(medications.deletedAt)))
        : []
      rows = data
      filename = 'medications.csv'
      break
    }
    case 'lab_results': {
      const data = await db
        .select({
          test_name: labResults.testName,
          value: labResults.value,
          unit: labResults.unit,
          reference_range: labResults.referenceRange,
          is_abnormal: labResults.isAbnormal,
          date_taken: labResults.dateTaken,
        })
        .from(labResults)
        .where(eq(labResults.userId, dbUser!.id))
      rows = data
      filename = 'lab-results.csv'
      break
    }
    case 'appointments': {
      const data = profileId
        ? await db
            .select({
              doctor_name: appointments.doctorName,
              specialty: appointments.specialty,
              date_time: appointments.dateTime,
              location: appointments.location,
              purpose: appointments.purpose,
            })
            .from(appointments)
            .where(and(eq(appointments.careProfileId, profileId), isNull(appointments.deletedAt)))
        : []
      rows = data
      filename = 'appointments.csv'
      break
    }
    case 'journal': {
      const data = await db
        .select({
          mood: symptomEntries.mood,
          energy: symptomEntries.energy,
          pain_level: symptomEntries.painLevel,
          sleep_hours: symptomEntries.sleepHours,
          symptoms: symptomEntries.symptoms,
          notes: symptomEntries.notes,
          created_at: symptomEntries.createdAt,
        })
        .from(symptomEntries)
        .where(eq(symptomEntries.userId, dbUser!.id))
      rows = data.map(r => ({ ...r, symptoms: (r.symptoms || []).join('; ') }))
      filename = 'journal.csv'
      break
    }
    default:
      return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No data to export' }, { status: 404 })
  }

  const headers = Object.keys(rows[0])
  const csvLines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const val = String(row[h] ?? '')
      return val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r') ? `"${val.replace(/"/g, '""')}"` : val
    }).join(','))
  ]

  return new NextResponse(csvLines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
