import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser, parseBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { z } from 'zod';

const AI_PERSONALITY = z.enum(['professional', 'friendly', 'concise']);

// PATCH — update user settings fields
export async function PATCH(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;

  const allowed: Record<string, unknown> = {};
  if (body.ai_personality !== undefined) {
    const parsed = AI_PERSONALITY.safeParse(body.ai_personality);
    if (!parsed.success) return apiError('Invalid ai_personality value', 400);
    allowed.aiPersonality = parsed.data;
  }
  if (body.notification_preferences !== undefined) allowed.notificationPreferences = body.notification_preferences;
  if (body.quiet_hours_enabled !== undefined) allowed.quietHoursEnabled = body.quiet_hours_enabled;
  if (body.quiet_hours_start !== undefined) allowed.quietHoursStart = body.quiet_hours_start;
  if (body.quiet_hours_end !== undefined) allowed.quietHoursEnd = body.quiet_hours_end;
  if (body.refill_reminders !== undefined) allowed.refillReminders = body.refill_reminders;
  if (body.appointment_reminders !== undefined) allowed.appointmentReminders = body.appointment_reminders;
  if (body.lab_alerts !== undefined) allowed.labAlerts = body.lab_alerts;
  if (body.claim_updates !== undefined) allowed.claimUpdates = body.claim_updates;
  if (body.email_notifications !== undefined) allowed.emailNotifications = body.email_notifications;
  if (body.push_notifications !== undefined) allowed.pushNotifications = body.push_notifications;
  if (body.timezone !== undefined) allowed.timezone = body.timezone;

  if (Object.keys(allowed).length === 0) return apiError('No valid fields to update', 400);

  allowed.updatedAt = new Date();

  const [existing] = await db
    .select({ id: userSettings.id })
    .from(userSettings)
    .where(eq(userSettings.userId, dbUser!.id))
    .limit(1);

  if (!existing) return apiError('User settings not found', 404);

  const [updated] = await db
    .update(userSettings)
    .set(allowed)
    .where(eq(userSettings.userId, dbUser!.id))
    .returning();

  return apiSuccess(updated);
}
