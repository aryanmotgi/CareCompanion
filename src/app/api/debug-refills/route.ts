import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: profile, error: profileErr } = await supabase
      .from('care_profiles')
      .select('id, patient_name')
      .eq('user_id', user.id)
      .single()

    const admin = createAdminClient()
    const { data: adminMeds, error: adminErr } = await admin
      .from('medications')
      .select('id, name')
      .eq('care_profile_id', profile?.id || 'none')

    const { data: allProfiles } = await admin
      .from('care_profiles')
      .select('id, patient_name')
      .eq('user_id', user.id)

    return NextResponse.json({
      user_id: user.id,
      profile,
      profile_error: profileErr?.message,
      all_profiles: allProfiles,
      admin_meds_count: adminMeds?.length,
      admin_meds: adminMeds?.map(m => m.name),
      admin_error: adminErr?.message,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
