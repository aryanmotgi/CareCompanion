import { db } from '@/lib/db';
import {
  careProfiles, userSettings, medications, appointments,
  priorAuths, labResults, fsaHsa, notifications, pushSubscriptions,
} from '@/lib/db/schema';
import { eq, and, gte, desc, isNull } from 'drizzle-orm';
import { sendPushNotification } from '@/lib/push';
import { generateAppointmentPrepForUser } from '@/lib/appointment-prep';

/**
 * Proactive notification engine for CareCompanion.
 * Scans a user's data and generates actionable alerts.
 * Designed to run on a cron schedule (every 15 min via Vercel).
 */
export async function generateNotificationsForUser(userId: string): Promise<number> {
  let generated = 0;

  // Get care profile and user settings in parallel
  const [[profile], [settings]] = await Promise.all([
    db.select({ id: careProfiles.id }).from(careProfiles).where(eq(careProfiles.userId, userId)).limit(1),
    db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1),
  ]);

  if (!profile) return 0;

  // Enforce quiet hours — skip notification generation if inside quiet window
  if (settings?.quietHoursEnabled) {
    const tz = 'UTC';
    let nowHour: number;
    let nowMinute: number;
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(new Date());
      nowHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
      nowMinute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    } catch {
      const utcNow = new Date();
      nowHour = utcNow.getUTCHours();
      nowMinute = utcNow.getUTCMinutes();
    }

    const start = settings.quietHoursStart;
    const end = settings.quietHoursEnd;

    if (start && end) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const nowMins = nowHour * 60 + nowMinute;
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;

      const inQuietHours = startMins <= endMins
        ? nowMins >= startMins && nowMins < endMins
        : nowMins >= startMins || nowMins < endMins;

      if (inQuietHours) return 0;
    }
  }

  // Respect user notification preferences (default to true if no settings)
  const prefs = {
    refill_reminders: settings?.refillReminders ?? true,
    appointment_reminders: settings?.appointmentReminders ?? true,
    lab_alerts: settings?.labAlerts ?? true,
    claim_updates: settings?.claimUpdates ?? true,
  };

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Fetch all relevant data in parallel
  const [
    meds,
    appts,
    auths,
    labs,
    accounts,
    existingNotifs,
  ] = await Promise.all([
    prefs.refill_reminders
      ? db.select().from(medications).where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt)))
      : Promise.resolve([]),
    prefs.appointment_reminders
      ? db.select().from(appointments).where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt)))
      : Promise.resolve([]),
    prefs.claim_updates
      ? db.select().from(priorAuths).where(eq(priorAuths.userId, userId))
      : Promise.resolve([]),
    prefs.lab_alerts
      ? db.select().from(labResults)
          .where(and(eq(labResults.userId, userId), eq(labResults.isAbnormal, true)))
          .orderBy(desc(labResults.createdAt))
          .limit(10)
      : Promise.resolve([]),
    db.select().from(fsaHsa).where(eq(fsaHsa.userId, userId)),
    // Get recent notifications to avoid duplicates (last 24 hours)
    db.select({ title: notifications.title, type: notifications.type })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), gte(notifications.createdAt, oneDayAgo))),
  ]);

  const existingTitles = new Set(existingNotifs.map((n) => n.title));
  const now = new Date();

  const toInsert: Array<{ userId: string; type: string; title: string; message: string }> = [];

  // ----------------------------------------------------------
  // 1. Medication refills due within 3 days
  // ----------------------------------------------------------
  for (const med of meds) {
    if (!med.refillDate) continue;
    const diff = Math.ceil((new Date(med.refillDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff <= 0) {
      const title = `${med.name} refill is overdue`;
      if (!existingTitles.has(title)) {
        toInsert.push({
          userId,
          type: 'refill_overdue',
          title,
          message: `The refill for ${med.name}${med.dose ? ` ${med.dose}` : ''} was due ${med.refillDate}. Contact the pharmacy or doctor to avoid a gap in medication.`,
        });
      }
    } else if (diff <= 3) {
      const title = `${med.name} refill due in ${diff} day${diff === 1 ? '' : 's'}`;
      if (!existingTitles.has(title)) {
        toInsert.push({
          userId,
          type: 'refill_soon',
          title,
          message: `${med.name}${med.dose ? ` ${med.dose}` : ''} refill is coming up on ${med.refillDate}. Would you like help contacting the pharmacy?`,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // 2. Appointments tomorrow — prep reminder
  // ----------------------------------------------------------
  for (const appt of appts) {
    if (!appt.dateTime) continue;
    const apptDate = new Date(appt.dateTime);
    const diff = Math.ceil((apptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 1) {
      const title = `Appointment tomorrow with ${appt.doctorName || 'your doctor'}`;
      if (!existingTitles.has(title)) {
        const time = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        // Auto-generate visit prep in the background (fire-and-forget, non-blocking)
        generateAppointmentPrepForUser(userId, appt.id).catch(() => {});

        toInsert.push({
          userId,
          type: 'appointment_prep',
          title,
          message: `${appt.doctorName || 'Appointment'} at ${time}${appt.location ? ` — ${appt.location}` : ''}. Your AI prep sheet is ready — open Visit Prep to see your personalized questions and what to bring.`,
        });
      }
    } else if (diff === 0) {
      const title = `Appointment today with ${appt.doctorName || 'your doctor'}`;
      if (!existingTitles.has(title)) {
        const time = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        toInsert.push({
          userId,
          type: 'appointment_today',
          title,
          message: `Don't forget — ${appt.doctorName || 'appointment'} at ${time} today.${appt.location ? ` Location: ${appt.location}` : ''}`,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // 3. Prior authorizations expiring within 14 days
  // ----------------------------------------------------------
  for (const auth of auths) {
    if (!auth.expiryDate) continue;
    const diff = Math.ceil((new Date(auth.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff > 0 && diff <= 14) {
      const title = `Prior auth for ${auth.service} expires in ${diff} day${diff === 1 ? '' : 's'}`;
      if (!existingTitles.has(title)) {
        const sessionsInfo = auth.sessionsApproved
          ? ` (${auth.sessionsUsed}/${auth.sessionsApproved} sessions used)`
          : '';
        toInsert.push({
          userId,
          type: 'prior_auth_expiring',
          title,
          message: `Your prior authorization for ${auth.service} expires ${auth.expiryDate}${sessionsInfo}. Contact your insurance to request a renewal.`,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // 4. New abnormal lab results (created in last hour)
  // ----------------------------------------------------------
  for (const lab of labs) {
    const createdAgo = lab.createdAt
      ? (now.getTime() - new Date(lab.createdAt).getTime()) / (1000 * 60 * 60)
      : 999;
    if (createdAgo <= 1) {
      const title = `Abnormal result: ${lab.testName}`;
      if (!existingTitles.has(title)) {
        toInsert.push({
          userId,
          type: 'abnormal_lab',
          title,
          message: `${lab.testName} came back at ${lab.value}${lab.unit ? ` ${lab.unit}` : ''} (normal range: ${lab.referenceRange || 'not specified'}). Ask CareCompanion to explain what this means.`,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // 5. Low FSA/HSA balance (under 10% of limit)
  // ----------------------------------------------------------
  for (const account of accounts) {
    if (!account.contributionLimit) continue;
    const balance = parseFloat(String(account.balance ?? '0'));
    const limit = parseFloat(String(account.contributionLimit));
    if (balance < limit * 0.1) {
      const title = `Low ${(account.accountType || 'account').toUpperCase()} balance: $${balance}`;
      if (!existingTitles.has(title)) {
        toInsert.push({
          userId,
          type: 'low_balance',
          title,
          message: `Your ${(account.accountType || 'account').toUpperCase()} with ${account.provider} has $${balance} remaining out of $${limit}.${account.accountType === 'fsa' ? ' FSA funds typically expire at year-end — plan your spending.' : ''}`,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // 6. Proactive treatment cycle awareness
  //    Infers cycle phase from medication notes/frequency and
  //    sends day-ahead warnings for critical treatment windows.
  // ----------------------------------------------------------
  for (const med of meds) {
    const notes = (med.notes || '').toLowerCase();
    const freq = (med.frequency || '').toLowerCase();

    // Only process chemo/treatment medications with cycle info
    const cycleMatch = notes.match(/cycle\s*(\d+)\s*(?:of|\/)\s*(\d+)/i);
    if (!cycleMatch) continue;

    // Infer cycle length
    let cycleLengthDays = 21;
    if (freq.includes('every 2 weeks') || freq.includes('every 14')) cycleLengthDays = 14;
    if (freq.includes('every 3 weeks') || freq.includes('every 21')) cycleLengthDays = 21;
    if (freq.includes('every 4 weeks') || freq.includes('every 28')) cycleLengthDays = 28;
    if (freq.includes('weekly')) cycleLengthDays = 7;

    // Infer day in cycle from refill date (next infusion)
    if (!med.refillDate) continue;
    const nextInfusion = new Date(med.refillDate);
    const daysUntilNext = Math.ceil((nextInfusion.getTime() - now.getTime()) / 86400000);
    const dayInCycle = Math.max(1, cycleLengthDays - daysUntilNext);
    const tomorrowDay = dayInCycle + 1;

    const drugName = med.name || 'treatment';
    const cycleNum = parseInt(cycleMatch[1]);

    // Nadir warning: ANC typically drops on days 7-14
    // Warn on the day before nadir starts (day 7)
    if (tomorrowDay === 8) {
      const title = `${drugName} — nadir period starts tomorrow`;
      if (!existingTitles.has(title)) {
        toInsert.push({
          userId,
          type: 'cycle_nadir_warning',
          title,
          message: `Cycle ${cycleNum}: tomorrow begins the nadir window (days 8-14) when blood counts are typically at their lowest. Watch for: fever over 100.4°F, chills, unusual fatigue. Keep a thermometer nearby and have the oncology after-hours number on hand.`,
        });
      }
    }

    // Nadir active: remind during the window (day 10 check-in)
    if (dayInCycle === 10) {
      const title = `${drugName} — you're in the nadir window (day ${dayInCycle})`;
      if (!existingTitles.has(title)) {
        toInsert.push({
          userId,
          type: 'cycle_nadir_active',
          title,
          message: `Cycle ${cycleNum}, day ${dayInCycle}: blood counts are likely at their lowest. Any fever over 100.4°F warrants a call to the oncology team — don't wait. Recovery phase begins around day 14-15.`,
        });
      }
    }

    // Recovery: positive check-in when emerging from nadir
    if (tomorrowDay === 15) {
      const title = `${drugName} — recovery phase begins tomorrow`;
      if (!existingTitles.has(title)) {
        toInsert.push({
          userId,
          type: 'cycle_recovery',
          title,
          message: `Cycle ${cycleNum}: tomorrow marks the start of the recovery phase. Blood counts should begin rising. Energy levels often improve over the next week. Next infusion in approximately ${daysUntilNext} days.`,
        });
      }
    }

    // Pre-infusion: remind 2 days before next cycle
    if (daysUntilNext === 2) {
      const title = `${drugName} — next infusion in 2 days`;
      if (!existingTitles.has(title)) {
        toInsert.push({
          userId,
          type: 'cycle_pre_infusion',
          title,
          message: `Cycle ${cycleNum + 1} infusion is scheduled in 2 days (${nextInfusion.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}). Make sure labs are scheduled and any pre-medications are on hand.`,
        });
      }
    }
  }

  // Insert all new notifications
  if (toInsert.length > 0) {
    await db.insert(notifications).values(toInsert);
    generated = toInsert.length;

    // Fire push notifications for each inserted notification (fire-and-forget)
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .catch(() => []);

    if (subs.length > 0) {
      for (const notification of toInsert) {
        for (const sub of subs) {
          sendPushNotification(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            { title: notification.title, body: notification.message ?? '', url: '/dashboard' },
          ).catch(async (err: unknown) => {
            // Remove invalid/expired subscriptions (HTTP 410 Gone)
            const status = (err as { statusCode?: number })?.statusCode;
            if (status === 410 || status === 404) {
              await db
                .delete(pushSubscriptions)
                .where(eq(pushSubscriptions.endpoint, sub.endpoint))
                .catch(() => {});
            }
          });
        }
      }
    }
  }

  return generated;
}

/**
 * Run notification generation for all users with care profiles.
 */
export async function generateNotificationsForAllUsers(): Promise<{ total: number; users: number }> {
  const profiles = await db
    .select({ userId: careProfiles.userId })
    .from(careProfiles);

  if (profiles.length === 0) return { total: 0, users: 0 };

  const BATCH_SIZE = 10;
  let total = 0;
  let processed = 0;

  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((p) => generateNotificationsForUser(p.userId))
    );
    for (const result of results) {
      processed++;
      if (result.status === 'fulfilled') {
        total += result.value;
      } else {
        console.error('[notifications] user generation failed:', result.reason);
      }
    }
  }

  return { total, users: processed };
}
