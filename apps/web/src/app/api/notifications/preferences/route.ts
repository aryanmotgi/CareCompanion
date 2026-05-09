/**
 * Notification preferences endpoint.
 * GET: Retrieve current preferences.
 * PUT: Update preferences (granular control over notification types, quiet hours).
 */
export const dynamic = 'force-dynamic'
import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers'
import { apiError, apiSuccess } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { validateCsrf } from '@/lib/csrf'

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
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user!.id))
      .limit(1)

    // Return defaults if no settings exist
    const prefs = {
      refill_reminders: settings?.refillReminders ?? true,
      appointment_reminders: settings?.appointmentReminders ?? true,
      lab_alerts: settings?.labAlerts ?? true,
      claim_updates: settings?.claimUpdates ?? true,
      ai_personality: settings?.aiPersonality ?? 'friendly',
      quiet_hours_start: settings?.quietHoursStart ?? null,
      quiet_hours_end: settings?.quietHoursEnd ?? null,
      email_notifications: settings?.emailNotifications ?? false,
      push_notifications: settings?.pushNotifications ?? true,
    }

    return apiSuccess(prefs)
  } catch (err) {
    console.error('[notification-prefs] GET error:', err)
    return apiError('Internal server error', 500)
  }
}

export async function PUT(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = await limiter.check(ip)
  if (!success) return apiError('Too many requests', 429)

  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const body = await req.json()
    const { data: validated, error: valError } = validateBody(PreferencesSchema, body)
    if (valError) return valError

    const updates = {
      refillReminders: validated.refill_reminders,
      appointmentReminders: validated.appointment_reminders,
      labAlerts: validated.lab_alerts,
      claimUpdates: validated.claim_updates,
      aiPersonality: validated.ai_personality,
      quietHoursStart: validated.quiet_hours_start,
      quietHoursEnd: validated.quiet_hours_end,
      emailNotifications: validated.email_notifications,
      pushNotifications: validated.push_notifications,
      updatedAt: new Date(),
    }

    // Remove undefined keys
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    ) as typeof updates

    const [existing] = await db
      .select({ id: userSettings.id })
      .from(userSettings)
      .where(eq(userSettings.userId, user!.id))
      .limit(1)

    if (existing) {
      await db.update(userSettings).set(cleanUpdates).where(eq(userSettings.userId, user!.id))
    } else {
      await db.insert(userSettings).values({ userId: user!.id, ...cleanUpdates })
    }

    return apiSuccess({ updated: true, preferences: validated })
  } catch (err) {
    console.error('[notification-prefs] PUT error:', err)
    return apiError('Internal server error', 500)
  }
}
