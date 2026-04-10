/**
 * Notification preferences endpoint.
 * GET: Retrieve current preferences.
 * PUT: Update preferences (granular control over notification types, quiet hours).
 */
import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers'
import { apiError, apiSuccess } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 })

const PreferencesSchema = z.object({
  refill_reminders: z.boolean().optional(),
  appointment_reminders: z.boolean().optional(),
  lab_alerts: z.boolean().optional(),
  claim_updates: z.boolean().optional(),
  ai_personality: z.enum(['professional', 'friendly', 'concise']).optional(),
  quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('HH:MM format, e.g., 22:00'),
  quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('HH:MM format, e.g., 07:00'),
  email_notifications: z.boolean().optional(),
  push_notifications: z.boolean().optional(),
}).strict()

export async function GET() {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const { data: settings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Return defaults if no settings exist
    const prefs = {
      refill_reminders: settings?.refill_reminders ?? true,
      appointment_reminders: settings?.appointment_reminders ?? true,
      lab_alerts: settings?.lab_alerts ?? true,
      claim_updates: settings?.claim_updates ?? true,
      ai_personality: settings?.ai_personality ?? 'friendly',
      quiet_hours_start: settings?.quiet_hours_start ?? null,
      quiet_hours_end: settings?.quiet_hours_end ?? null,
      email_notifications: settings?.email_notifications ?? false,
      push_notifications: settings?.push_notifications ?? true,
    }

    return apiSuccess(prefs)
  } catch (err) {
    console.error('[notification-prefs] GET error:', err)
    return apiError('Internal server error', 500)
  }
}

export async function PUT(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = limiter.check(ip)
  if (!success) return apiError('Too many requests', 429)

  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const body = await req.json()
    const { data: validated, error: valError } = validateBody(PreferencesSchema, body)
    if (valError) return valError

    // Upsert settings
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('user_settings')
        .update({ ...validated, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)

      if (error) {
        console.error('[notification-prefs] Update error:', error)
        return apiError('Failed to update preferences', 500)
      }
    } else {
      const { error } = await supabase
        .from('user_settings')
        .insert({ user_id: user.id, ...validated })

      if (error) {
        console.error('[notification-prefs] Insert error:', error)
        return apiError('Failed to save preferences', 500)
      }
    }

    return apiSuccess({ updated: true, preferences: validated })
  } catch (err) {
    console.error('[notification-prefs] PUT error:', err)
    return apiError('Internal server error', 500)
  }
}
