/**
 * Caregiver burnout assessment endpoint.
 * Analyzes journal entries and appointment load to detect burnout signals.
 */
import { createClient } from '@/lib/supabase/server'
import { assessBurnout } from '@/lib/caregiver-burnout'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    const { data: profile } = await supabase
      .from('care_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    // Fetch recent journal entries and upcoming appointments
    const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const [{ data: entries }, { data: appointments }] = await Promise.all([
      supabase
        .from('symptom_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(14),
      profile ? supabase
        .from('appointments')
        .select('id')
        .eq('care_profile_id', profile.id)
        .gte('date_time', new Date().toISOString())
        .lte('date_time', twoWeeksFromNow) : Promise.resolve({ data: [] }),
    ])

    // Calculate days since last journal entry
    let daysSinceLastEntry: number | null = null
    if (entries && entries.length > 0) {
      const lastDate = new Date(entries[0].date)
      daysSinceLastEntry = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    }

    const assessment = assessBurnout(
      entries || [],
      (appointments || []).length,
      daysSinceLastEntry,
    )

    return apiSuccess(assessment)
  } catch (error) {
    console.error('[burnout] Error:', error)
    return ApiErrors.internal()
  }
}
