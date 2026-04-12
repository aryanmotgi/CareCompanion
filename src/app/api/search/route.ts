import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiSuccess, apiError } from '@/lib/api-response'

export async function GET(req: Request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')?.trim()
    if (!query || query.length < 2) {
      return apiSuccess({ results: [] })
    }

    const { data: profile } = await supabase
      .from('care_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const profileId = profile?.id
    const searchPattern = `%${query}%`

    // Search across all data types in parallel
    const [medications, appointments, labResults, documents, journal] = await Promise.all([
      profileId
        ? supabase.from('medications').select('id, name, dose, frequency').eq('care_profile_id', profileId).ilike('name', searchPattern).limit(5)
        : { data: [] },
      profileId
        ? supabase.from('appointments').select('id, doctor_name, specialty, date, location').eq('care_profile_id', profileId).or(`doctor_name.ilike.${searchPattern},specialty.ilike.${searchPattern},location.ilike.${searchPattern}`).limit(5)
        : { data: [] },
      supabase.from('lab_results').select('id, test_name, value, unit, date_taken, is_abnormal').eq('user_id', user.id).ilike('test_name', searchPattern).limit(5),
      profileId
        ? supabase.from('documents').select('id, document_type, summary, created_at').eq('care_profile_id', profileId).or(`document_type.ilike.${searchPattern},summary.ilike.${searchPattern}`).limit(5)
        : { data: [] },
      supabase.from('symptom_entries').select('id, notes, symptoms, created_at').eq('user_id', user.id).ilike('notes', searchPattern).limit(5),
    ])

    const results = [
      ...(medications.data || []).map(m => ({ type: 'medication' as const, id: m.id, title: m.name, subtitle: [m.dose, m.frequency].filter(Boolean).join(' \u00b7 '), href: '/medications' })),
      ...(appointments.data || []).map(a => ({ type: 'appointment' as const, id: a.id, title: `${a.doctor_name}${a.specialty ? ` \u00b7 ${a.specialty}` : ''}`, subtitle: a.date ? new Date(a.date).toLocaleDateString() : a.location || '', href: '/appointments' })),
      ...(labResults.data || []).map(l => ({ type: 'lab' as const, id: l.id, title: l.test_name, subtitle: `${l.value || ''}${l.unit ? ` ${l.unit}` : ''}${l.is_abnormal ? ' \u26a0\ufe0f' : ''}`, href: '/labs' })),
      ...(documents.data || []).map(d => ({ type: 'document' as const, id: d.id, title: d.document_type || 'Document', subtitle: d.summary?.slice(0, 80) || '', href: '/scans' })),
      ...(journal.data || []).map(j => ({ type: 'journal' as const, id: j.id, title: 'Journal Entry', subtitle: j.notes?.slice(0, 80) || (j.symptoms || []).join(', '), href: '/journal' })),
    ]

    return apiSuccess({ results, query })
  } catch (err) {
    console.error('[search] GET error:', err)
    return apiError('Internal server error', 500)
  }
}
