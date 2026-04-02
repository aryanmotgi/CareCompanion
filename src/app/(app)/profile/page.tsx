import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileDashboard } from '@/components/ProfileDashboard'
import { ProfileSkeleton } from '@/components/skeletons/ProfileSkeleton'

async function ProfileContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/setup')

  const [{ data: doctors }, { data: labResults }] = await Promise.all([
    supabase.from('doctors').select('*').eq('care_profile_id', profile.id),
    supabase.from('lab_results').select('*').eq('user_id', user.id).order('date_taken', { ascending: false }).limit(50),
  ])

  return (
    <ProfileDashboard
      profile={profile}
      doctors={doctors || []}
      labResults={labResults || []}
    />
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  )
}
