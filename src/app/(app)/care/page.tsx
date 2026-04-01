import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CareView } from '@/components/CareView'

export default async function CarePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/setup')

  const [{ data: medications }, { data: appointments }] = await Promise.all([
    supabase
      .from('medications')
      .select('*')
      .eq('care_profile_id', profile.id)
      .order('name'),
    supabase
      .from('appointments')
      .select('*')
      .eq('care_profile_id', profile.id)
      .order('date_time', { ascending: true }),
  ])

  return (
    <CareView
      profileId={profile.id}
      medications={medications || []}
      appointments={appointments || []}
    />
  )
}
