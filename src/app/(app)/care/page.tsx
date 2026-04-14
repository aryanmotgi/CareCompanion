import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CareView } from '@/components/CareView'
import { CareSkeleton } from '@/components/skeletons/CareSkeleton'
import { ComplianceReport } from '@/components/ComplianceReport'
import { AdherenceCalendar } from '@/components/AdherenceCalendar'
import { TreatmentCycleTracker } from '@/components/TreatmentCycleTracker'
import { getAllProfiles } from '@/lib/active-profile'

async function CareContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id, patient_name')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/setup')

  const allProfiles = await getAllProfiles(supabase, user.id)

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: medications }, { data: appointments }, { data: doctors }, { data: careTeamMembers }, { data: todayLogs }, { data: labResults }, { data: symptoms }] = await Promise.all([
    supabase.from('medications').select('*').eq('care_profile_id', profile.id),
    supabase.from('appointments').select('*').eq('care_profile_id', profile.id).order('date_time', { ascending: true }),
    supabase.from('doctors').select('*').eq('care_profile_id', profile.id),
    supabase.from('care_team_members').select('*').eq('care_profile_id', profile.id),
    supabase.from('reminder_logs').select('*').eq('user_id', user.id)
      .gte('scheduled_time', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .order('scheduled_time'),
    supabase.from('lab_results').select('*').eq('user_id', user.id).order('date_taken', { ascending: false }),
    supabase.from('symptom_entries').select('*').eq('user_id', user.id).gte('date', since).order('date', { ascending: false }),
  ])

  return (
    <>
      <div className="px-4 sm:px-5 pt-5">
        <TreatmentCycleTracker
          medications={medications || []}
          patientName={profile.patient_name || 'Patient'}
        />
      </div>
      <CareView
        profileId={profile.id}
        medications={medications || []}
        appointments={appointments || []}
        doctors={doctors || []}
        allProfiles={allProfiles}
        careTeamMembers={careTeamMembers || []}
        todayReminders={todayLogs || []}
        labResults={labResults || []}
        symptoms={symptoms || []}
        patientName={profile.patient_name || 'Patient'}
      />
      <div className="px-4 sm:px-5 pb-6 space-y-5">
        <AdherenceCalendar />
        <ComplianceReport />
      </div>
    </>
  )
}

export default function CarePage() {
  return (
    <Suspense fallback={<CareSkeleton />}>
      <CareContent />
    </Suspense>
  )
}
