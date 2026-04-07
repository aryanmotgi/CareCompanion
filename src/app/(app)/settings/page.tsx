import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsPage } from '@/components/SettingsPage'
import { SettingsSkeleton } from '@/components/skeletons/SettingsSkeleton'
import { getActiveProfile } from '@/lib/active-profile'

async function SettingsContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getActiveProfile(supabase, user.id)

  // Fetch or create user settings
  let { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!settings) {
    const { data: newSettings } = await supabase
      .from('user_settings')
      .insert({ user_id: user.id })
      .select()
      .single()
    settings = newSettings
  }

  const [
    { data: connectedApps },
    { data: medicationReminders },
    { data: medications },
  ] = await Promise.all([
    supabase.from('connected_apps').select('*').eq('user_id', user.id),
    supabase.from('medication_reminders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    profile
      ? supabase.from('medications').select('*').eq('care_profile_id', profile.id)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <SettingsPage
      settings={settings}
      connectedApps={connectedApps || []}
      medicationReminders={medicationReminders || []}
      medications={medications || []}
    />
  )
}

export default function SettingsRoute() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  )
}
