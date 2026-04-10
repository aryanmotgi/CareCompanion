import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'medications'

  const { data: profile } = await supabase.from('care_profiles').select('id').eq('user_id', user.id).single()
  const profileId = profile?.id

  let rows: Record<string, unknown>[] = []
  let filename = 'export.csv'

  switch (type) {
    case 'medications': {
      const { data } = profileId
        ? await supabase.from('medications').select('name, dose, frequency, prescribing_doctor, refill_date, created_at').eq('care_profile_id', profileId)
        : { data: [] }
      rows = data || []
      filename = 'medications.csv'
      break
    }
    case 'lab_results': {
      const { data } = await supabase.from('lab_results').select('test_name, value, unit, reference_range, is_abnormal, date_taken').eq('user_id', user.id)
      rows = data || []
      filename = 'lab-results.csv'
      break
    }
    case 'appointments': {
      const { data } = profileId
        ? await supabase.from('appointments').select('doctor_name, specialty, date, time, location, notes').eq('care_profile_id', profileId)
        : { data: [] }
      rows = data || []
      filename = 'appointments.csv'
      break
    }
    case 'journal': {
      const { data } = await supabase.from('symptom_entries').select('mood, energy_level, pain_level, sleep_hours, symptoms, notes, created_at').eq('user_id', user.id)
      rows = (data || []).map(r => ({ ...r, symptoms: (r.symptoms || []).join('; ') }))
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
      return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val
    }).join(','))
  ]

  return new NextResponse(csvLines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
