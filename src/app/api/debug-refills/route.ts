import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRefillStatus } from '@/lib/refill-tracker'

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

    // Also test checkRefillStatus directly
    const checkResult = profile?.id ? await checkRefillStatus(profile.id) : []

    return NextResponse.json({
      user_id: user.id,
      profile_id: profile?.id,
      profile_error: profileErr?.message,
      admin_meds_count: adminMeds?.length,
      admin_meds: adminMeds?.map(m => m.name),
      admin_error: adminErr?.message,
      check_refill_status_count: checkResult.length,
      check_refill_meds: checkResult.map(r => r.medication_name),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
