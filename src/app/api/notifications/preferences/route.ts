/**
 * Notification preferences endpoint.
 * GET: Retrieve current preferences.
 * PUT: Update preferences (granular control over notification types, quiet hours).
 */
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { z } from 'zod'

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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

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
  } catch (error) {
    console.error('[notification-prefs] GET error:', error)
    return ApiErrors.internal()
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    const body = await req.json()
    const parsed = PreferencesSchema.safeParse(body)
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid preferences: ' + parsed.error.issues.map(i => `${i.path}: ${i.message}`).join(', '))
    }

    // Upsert settings
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('user_settings')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)

      if (error) {
        console.error('[notification-prefs] Update error:', error)
        return ApiErrors.internal('Failed to update preferences')
      }
    } else {
      const { error } = await supabase
        .from('user_settings')
        .insert({ user_id: user.id, ...parsed.data })

      if (error) {
        console.error('[notification-prefs] Insert error:', error)
        return ApiErrors.internal('Failed to save preferences')
      }
    }

    return apiSuccess({ updated: true, preferences: parsed.data })
  } catch (error) {
    console.error('[notification-prefs] PUT error:', error)
    return ApiErrors.internal()
  }
}
