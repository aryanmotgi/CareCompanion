import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess, ApiErrors } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { medicationReminders, reminderLogs } from '@/lib/db/schema';
import { and, eq, gte, asc } from 'drizzle-orm';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const PostSchema = z.object({
  medication_id: z.string().min(1, 'medication_id is required'),
  medication_name: z.string().min(1, 'medication_name is required'),
  dose: z.string().optional(),
  reminder_times: z.array(z.string()).min(1, 'At least one reminder time is required'),
  days_of_week: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
});

const DeleteSchema = z.object({
  reminder_id: z.string().min(1, 'reminder_id is required'),
});

// GET — list all medication reminders for the user
export async function GET() {
  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [reminders, todayLogs] = await Promise.all([
      db.select().from(medicationReminders).where(eq(medicationReminders.userId, dbUser!.id)).orderBy(asc(medicationReminders.createdAt)),
      db.select().from(reminderLogs).where(
        and(eq(reminderLogs.userId, dbUser!.id), gte(reminderLogs.scheduledTime, todayStart))
      ).orderBy(asc(reminderLogs.scheduledTime)),
    ]);

    return apiSuccess({ reminders, todayLogs });
  } catch (err) {
    console.error('[reminders] GET error:', err);
    return apiError('Internal server error', 500);
  }
}

// POST — create or update a medication reminder
export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) {
    return ApiErrors.rateLimited();
  }

  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(PostSchema, body);
    if (valError) return valError;

    const { medication_id, medication_name, dose, reminder_times, days_of_week } = validated;

    await db.insert(medicationReminders).values({
      userId: dbUser!.id,
      medicationId: medication_id,
      medicationName: medication_name,
      dose: dose || null,
      reminderTimes: reminder_times,
      daysOfWeek: days_of_week || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      isActive: true,
    }).onConflictDoUpdate({
      target: [medicationReminders.userId, medicationReminders.medicationId],
      set: {
        medicationName: medication_name,
        dose: dose || null,
        reminderTimes: reminder_times,
        daysOfWeek: days_of_week || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        isActive: true,
      },
    });

    return apiSuccess({ success: true, message: `Reminder set for ${medication_name}.` });
  } catch (err) {
    console.error('[reminders] POST error:', err);
    return apiError('Internal server error', 500);
  }
}

// DELETE — remove a medication reminder
export async function DELETE(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success: rlSuccess } = await limiter.check(ip);
  if (!rlSuccess) {
    return ApiErrors.rateLimited();
  }

  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(DeleteSchema, body);
    if (valError) return valError;

    await db.delete(medicationReminders).where(
      and(eq(medicationReminders.id, validated.reminder_id), eq(medicationReminders.userId, dbUser!.id))
    );
    return apiSuccess({ success: true });
  } catch (err) {
    console.error('[reminders] DELETE error:', err);
    return apiError('Internal server error', 500);
  }
}
