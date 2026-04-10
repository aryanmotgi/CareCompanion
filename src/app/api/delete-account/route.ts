import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import { validateCsrf } from '@/lib/csrf'

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 })

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = limiter.check(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    await logAudit({
      user_id: user.id,
      action: 'delete_account',
      ip_address: req.headers.get('x-forwarded-for') || undefined,
    })

    console.log(`[delete-account] Starting account deletion for user ${user.id}`)

    // Use admin client to bypass RLS policies
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Delete in dependency order (children first, then parents)
    // Tables with foreign keys to care_profiles
    const { data: profiles } = await admin.from('care_profiles').select('id').eq('user_id', user.id)
    const profileIds = (profiles || []).map(p => p.id)

    if (profileIds.length > 0) {
      // Delete care_profile children
      for (const pid of profileIds) {
        await admin.from('medications').delete().eq('care_profile_id', pid)
        await admin.from('appointments').delete().eq('care_profile_id', pid)
        await admin.from('doctors').delete().eq('care_profile_id', pid)
        await admin.from('documents').delete().eq('care_profile_id', pid)
        await admin.from('care_team_members').delete().eq('care_profile_id', pid)
        await admin.from('shared_links').delete().eq('care_profile_id', pid)
      }
    }

    // Delete all user-level tables (order doesn't matter for these)
    const userTables = [
      'reminder_logs',
      'medication_reminders',
      'symptom_entries',
      'memories',
      'conversation_summaries',
      'health_summaries',
      'audit_logs',
      'lab_results',
      'claims',
      'prior_authorizations',
      'fsa_hsa',
      'insurance',
      'notifications',
      'user_settings',
      'user_preferences',
      'connected_apps',
      'messages',
      'care_profiles',
    ]

    for (const table of userTables) {
      const { error } = await admin.from(table).delete().eq('user_id', user.id)
      if (error) {
        console.log(`[delete-account] Note: ${table} delete: ${error.message}`)
      }
    }

    // Delete auth user
    const { error: authError } = await admin.auth.admin.deleteUser(user.id)
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
