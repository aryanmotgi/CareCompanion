import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CareView } from '@/components/CareView'
import { CareSkeleton } from '@/components/skeletons/CareSkeleton'

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

  const [{ data: medications }, { data: appointments }, { data: doctors }] = await Promise.all([
    supabase.from('medications').select('*').eq('care_profile_id', profile.id),
    supabase.from('appointments').select('*').eq('care_profile_id', profile.id).order('date_time', { ascending: true }),
    supabase.from('doctors').select('*').eq('care_profile_id', profile.id),
  ])

  return (
    <CareView
      profileId={profile.id}
      medications={medications || []}
      appointments={appointments || []}
      doctors={doctors || []}
    />
  )
}

export default function CarePage() {
  return (
    <Suspense fallback={<CareSkeleton />}>
      <CareContent />
    </Suspense>
  )
}
