import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsPage } from '@/components/SettingsPage'
import { SettingsSkeleton } from '@/components/skeletons/SettingsSkeleton'

async function SettingsContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  const { data: connectedApps } = await supabase
    .from('connected_apps')
    .select('*')
    .eq('user_id', user.id)

  return (
    <SettingsPage
      settings={settings}
      connectedApps={connectedApps || []}
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
