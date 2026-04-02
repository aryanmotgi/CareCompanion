import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('care_profiles').select('*').eq('user_id', user.id).single()
  const profileId = profile?.id

  const [medications, appointments, doctors, labResults, claims, documents, notifications] = await Promise.all([
    profileId ? supabase.from('medications').select('*').eq('care_profile_id', profileId) : { data: [] },
    profileId ? supabase.from('appointments').select('*').eq('care_profile_id', profileId) : { data: [] },
    profileId ? supabase.from('doctors').select('*').eq('care_profile_id', profileId) : { data: [] },
    supabase.from('lab_results').select('*').eq('user_id', user.id),
    supabase.from('claims').select('*').eq('user_id', user.id),
    profileId ? supabase.from('documents').select('*').eq('care_profile_id', profileId) : { data: [] },
    supabase.from('notifications').select('*').eq('user_id', user.id),
  ])

  const exportData = {
    exported_at: new Date().toISOString(),
    profile,
    medications: medications.data,
    appointments: appointments.data,
    doctors: doctors.data,
    lab_results: labResults.data,
    claims: claims.data,
    documents: documents.data,
    notifications: notifications.data,
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="carecompanion-data.json"',
    },
  })
}
