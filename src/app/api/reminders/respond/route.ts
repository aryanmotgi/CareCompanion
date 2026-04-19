import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { reminderLogs, notifications } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const RespondSchema = z.object({
  log_id: z.string().min(1, 'log_id is required'),
  status: z.union([z.literal('taken'), z.literal('snoozed'), z.literal('missed')], {
    message: 'Status must be taken, snoozed, or missed',
  }),
});

// POST — mark a medication reminder as taken, snoozed, or missed
export async function POST(req: Request) {
  try {
    const { valid, error: csrfError } = await validateCsrf(req);
    if (!valid) return csrfError!;

    const { user: dbUser, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(RespondSchema, body);
    if (valError) return valError;

    const { log_id, status } = validated;

    if (status === 'snoozed') {
      const [log] = await db
        .select()
        .from(reminderLogs)
        .where(and(eq(reminderLogs.id, log_id), eq(reminderLogs.userId, dbUser!.id)))
        .limit(1);

      if (!log) return apiError('Reminder not found', 404);

      const snoozedTime = new Date(Date.now() + 15 * 60 * 1000);
      await db.update(reminderLogs).set({ scheduledTime: snoozedTime, status: 'pending' }).where(eq(reminderLogs.id, log_id));

      await db.insert(notifications).values({
        userId: dbUser!.id,
        type: 'medication_reminder',
        title: `Reminder: take ${log.medicationName}`,
        message: 'Snoozed reminder — time to take your medication now.',
      });

      return apiSuccess({ success: true, message: 'Snoozed for 15 minutes.' });
    }

    await db.update(reminderLogs).set({ status, respondedAt: new Date() })
      .where(and(eq(reminderLogs.id, log_id), eq(reminderLogs.userId, dbUser!.id)));

    return apiSuccess({ success: true, message: status === 'taken' ? 'Marked as taken!' : 'Marked as missed.' });
  } catch (err) {
    console.error('[reminders/respond] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
