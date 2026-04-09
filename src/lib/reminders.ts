import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/**
 * Check all active medication reminders and generate notifications + logs
 * for any that are due. Runs on cron every 15 minutes.
 */
export async function checkMedicationReminders(): Promise<{ generated: number }> {
  const admin = createAdminClient();
  const now = new Date();
  const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
  const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  // Window: check reminders within 15 minutes of current time
  const windowMinutes = 15;

  const { data: reminders } = await admin
    .from('medication_reminders')
    .select('*')
    .eq('is_active', true)
    .contains('days_of_week', [currentDay]);

  if (!reminders || reminders.length === 0) return { generated: 0 };

  let generated = 0;

  // Build a map of user quiet hours to skip notifications during quiet periods
  const userIds = Array.from(new Set(reminders.map((r) => r.user_id)));
  const { data: allSettings } = await admin
    .from('user_settings')
    .select('user_id, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone')
    .in('user_id', userIds);

  const settingsMap = new Map(
    (allSettings || []).map((s) => [s.user_id, s])
  );

  for (const reminder of reminders) {
    // Enforce quiet hours per user
    const userSettings = settingsMap.get(reminder.user_id);
    if (userSettings?.quiet_hours_enabled && userSettings.quiet_hours_start && userSettings.quiet_hours_end) {
      const tz = userSettings.timezone || 'UTC';
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
      const [sh, sm] = userSettings.quiet_hours_start.split(':').map(Number);
      const [eh, em] = userSettings.quiet_hours_end.split(':').map(Number);
      const nowMins = nowHour * 60 + nowMinute;
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      const inQuiet = startMins <= endMins
        ? nowMins >= startMins && nowMins < endMins
        : nowMins >= startMins || nowMins < endMins;
      if (inQuiet) continue;
    }

    for (const timeStr of reminder.reminder_times) {
      // Check if this reminder time is within our 15-minute window
      if (!isWithinWindow(currentTime, timeStr, windowMinutes)) continue;

      // Build the scheduled timestamp for this specific reminder
      const scheduledTime = new Date(now);
      const [hours, minutes] = timeStr.split(':').map(Number);
      scheduledTime.setHours(hours, minutes, 0, 0);

      // Check if we already created a log for this time slot today
      const startOfSlot = new Date(scheduledTime.getTime() - windowMinutes * 60000);
      const endOfSlot = new Date(scheduledTime.getTime() + windowMinutes * 60000);

      const { data: existing } = await admin
        .from('reminder_logs')
        .select('id')
        .eq('reminder_id', reminder.id)
        .gte('scheduled_time', startOfSlot.toISOString())
        .lte('scheduled_time', endOfSlot.toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Create the reminder log
      await admin.from('reminder_logs').insert({
        user_id: reminder.user_id,
        reminder_id: reminder.id,
        medication_name: reminder.medication_name,
        scheduled_time: scheduledTime.toISOString(),
        status: 'pending',
      });

      // Create a notification
      await admin.from('notifications').insert({
        user_id: reminder.user_id,
        type: 'medication_reminder',
        title: `Time to take ${reminder.medication_name}`,
        message: `${reminder.dose || ''} — scheduled for ${formatTime(timeStr)}. Tap to confirm you've taken it.`,
      });

      generated++;
    }
  }

  // Mark any reminders from >2 hours ago that are still pending as missed
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  await admin
    .from('reminder_logs')
    .update({ status: 'missed' })
    .eq('status', 'pending')
    .lt('scheduled_time', twoHoursAgo);

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
