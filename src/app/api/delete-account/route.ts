import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    console.log(`[delete-account] Starting account deletion for user ${user.id}`)

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
    const { error: authError } = await adminSupabase.auth.admin.deleteUser(user.id)
    if (authError) {
      console.error(`[delete-account] Failed to delete auth user ${user.id}:`, authError)
      return NextResponse.json({ error: 'Failed to delete auth account' }, { status: 500 })
    }

    console.log(`[delete-account] Successfully deleted user ${user.id}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[delete-account] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
