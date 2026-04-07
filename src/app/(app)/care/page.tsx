import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CareView } from '@/components/CareView'
import { CareSkeleton } from '@/components/skeletons/CareSkeleton'
import { ComplianceReport } from '@/components/ComplianceReport'
import { getAllProfiles } from '@/lib/active-profile'

async function CareContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/setup')

  const allProfiles = await getAllProfiles(supabase, user.id)

  const [{ data: medications }, { data: appointments }, { data: doctors }, { data: careTeamMembers }] = await Promise.all([
    supabase.from('medications').select('*').eq('care_profile_id', profile.id),
    supabase.from('appointments').select('*').eq('care_profile_id', profile.id).order('date_time', { ascending: true }),
    supabase.from('doctors').select('*').eq('care_profile_id', profile.id),
    supabase.from('care_team_members').select('*').eq('care_profile_id', profile.id),
  ])

  return (
    <>
      <CareView
        profileId={profile.id}
        medications={medications || []}
        appointments={appointments || []}
        doctors={doctors || []}
        allProfiles={allProfiles}
        careTeamMembers={careTeamMembers || []}
      />
      <div className="px-4 sm:px-5 pb-6">
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
