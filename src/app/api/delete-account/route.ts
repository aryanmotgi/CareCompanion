import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Delete all user data (cascading from care_profiles handles medications, appointments, doctors, documents)
  await supabase.from('care_profiles').delete().eq('user_id', user.id)
  await supabase.from('lab_results').delete().eq('user_id', user.id)
  await supabase.from('claims').delete().eq('user_id', user.id)
  await supabase.from('notifications').delete().eq('user_id', user.id)
  await supabase.from('user_settings').delete().eq('user_id', user.id)
  await supabase.from('connected_apps').delete().eq('user_id', user.id)
  await supabase.from('messages').delete().eq('user_id', user.id)

  // Delete auth user using service-role admin client
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await adminSupabase.auth.admin.deleteUser(user.id)

  return NextResponse.json({ success: true })
}
