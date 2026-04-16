import { db } from '@/lib/db';
import { medicationReminders, userSettings, reminderLogs, notifications } from '@/lib/db/schema';
import { eq, and, gte, lte, lt } from 'drizzle-orm';
import { inArray } from 'drizzle-orm';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/**
 * Check all active medication reminders and generate notifications + logs
 * for any that are due. Runs on cron every 15 minutes.
 */
export async function checkMedicationReminders(): Promise<{ generated: number }> {
  const now = new Date();
  const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
  const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  // Window: check reminders within 15 minutes of current time
  const windowMinutes = 15;

  // Fetch active reminders for today's day of week
  // Drizzle doesn't have array contains, so we filter in JS after fetch
  const allReminders = await db
    .select()
    .from(medicationReminders)
    .where(eq(medicationReminders.isActive, true));

  const reminders = allReminders.filter(r => r.daysOfWeek?.includes(currentDay));

  if (reminders.length === 0) return { generated: 0 };

  let generated = 0;

  // Build a map of user quiet hours to skip notifications during quiet periods
  const userIds = Array.from(new Set(reminders.map((r) => r.userId)));
  const allSettings = userIds.length > 0
    ? await db.select({
        userId: userSettings.userId,
        quietHoursEnabled: userSettings.quietHoursEnabled,
        quietHoursStart: userSettings.quietHoursStart,
        quietHoursEnd: userSettings.quietHoursEnd,
      })
      .from(userSettings)
      .where(inArray(userSettings.userId, userIds))
    : [];

  const settingsMap = new Map(allSettings.map((s) => [s.userId, s]));

  for (const reminder of reminders) {
    // Enforce quiet hours per user
    const userSetting = settingsMap.get(reminder.userId);
    if (userSetting?.quietHoursEnabled && userSetting.quietHoursStart && userSetting.quietHoursEnd) {
      const tz = 'UTC';
      let nowHour: number;
      let nowMinute: number;
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        }).formatToParts(now);
        nowHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
        nowMinute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
      } catch {
        nowHour = now.getUTCHours();
        nowMinute = now.getUTCMinutes();
      }
      const [sh, sm] = userSetting.quietHoursStart.split(':').map(Number);
      const [eh, em] = userSetting.quietHoursEnd.split(':').map(Number);
      const nowMins = nowHour * 60 + nowMinute;
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      const inQuiet = startMins <= endMins
        ? nowMins >= startMins && nowMins < endMins
        : nowMins >= startMins || nowMins < endMins;
      if (inQuiet) continue;
    }

    for (const timeStr of (reminder.reminderTimes || [])) {
      // Check if this reminder time is within our 15-minute window
      if (!isWithinWindow(currentTime, timeStr, windowMinutes)) continue;

      // Build the scheduled timestamp for this specific reminder
      const scheduledTime = new Date(now);
      const [hours, minutes] = timeStr.split(':').map(Number);
      scheduledTime.setHours(hours, minutes, 0, 0);

      // Check if we already created a log for this time slot today
      const startOfSlot = new Date(scheduledTime.getTime() - windowMinutes * 60000);
      const endOfSlot = new Date(scheduledTime.getTime() + windowMinutes * 60000);

      const existing = await db
        .select({ id: reminderLogs.id })
        .from(reminderLogs)
        .where(
          and(
            eq(reminderLogs.reminderId, reminder.id),
            gte(reminderLogs.scheduledTime, startOfSlot),
            lte(reminderLogs.scheduledTime, endOfSlot),
          )
        )
        .limit(1);

      if (existing.length > 0) continue;

      // Create the reminder log
      await db.insert(reminderLogs).values({
        userId: reminder.userId,
        reminderId: reminder.id,
        medicationName: reminder.medicationName,
        scheduledTime,
        status: 'pending',
      });

      // Create a notification
      await db.insert(notifications).values({
        userId: reminder.userId,
        type: 'medication_reminder',
        title: `Time to take ${reminder.medicationName}`,
        message: `${reminder.dose || ''} — scheduled for ${formatTime(timeStr)}. Tap to confirm you've taken it.`,
      });

      generated++;
    }
  }

  // Mark any reminders from >2 hours ago that are still pending as missed
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  await db
    .update(reminderLogs)
    .set({ status: 'missed' })
    .where(and(eq(reminderLogs.status, 'pending'), lt(reminderLogs.scheduledTime, twoHoursAgo)));

  return { generated };
}

function isWithinWindow(current: string, target: string, windowMins: number): boolean {
  const [ch, cm] = current.split(':').map(Number);
  const [th, tm] = target.split(':').map(Number);
  const currentMins = ch * 60 + cm;
  const targetMins = th * 60 + tm;
  const diff = Math.abs(currentMins - targetMins);
  return diff <= windowMins || diff >= (1440 - windowMins); // Handle midnight wrap
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}
