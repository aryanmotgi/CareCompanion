import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: apps } = await supabase
    .from('connected_apps')
    .select('*')
    .eq('user_id', user.id)
    .order('last_synced', { ascending: false })

  // Get recent sync errors from audit_logs if available
  const { data: recentErrors } = await supabase
    .from('audit_logs')
    .select('action, details, created_at')
    .eq('user_id', user.id)
    .like('action', 'sync_%')
    .order('created_at', { ascending: false })
    .limit(10)

  const cronSchedule = [
    { name: 'Data Sync', schedule: 'Daily at 6:00 AM', path: '/api/cron/sync' },
    { name: 'Full Sync', schedule: 'Daily at 8:00 AM', path: '/api/sync/all' },
    { name: 'Notifications', schedule: 'Daily at 9:00 AM', path: '/api/notifications/generate' },
    { name: 'Reminders', schedule: 'Daily at 10:00 AM', path: '/api/reminders/check' },
    { name: 'Data Cleanup', schedule: 'Weekly (Sunday 3 AM)', path: '/api/cron/purge' },
  ]

  return NextResponse.json({
    connected_apps: apps || [],
    recent_errors: recentErrors || [],
    cron_schedule: cronSchedule,
  })
}
