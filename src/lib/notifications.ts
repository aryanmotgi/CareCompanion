import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Proactive notification engine for CareCompanion.
 * Scans a user's data and generates actionable alerts.
 * Designed to run on a cron schedule (every 15 min via Vercel).
 */
export async function generateNotificationsForUser(userId: string): Promise<number> {
  const admin = createAdminClient();
  let generated = 0;

  // Get care profile and user settings in parallel
  const [{ data: profile }, { data: settings }] = await Promise.all([
    admin.from('care_profiles').select('id').eq('user_id', userId).single(),
    admin.from('user_settings').select('*').eq('user_id', userId).single(),
  ]);

  if (!profile) return 0;

  // Enforce quiet hours — skip notification generation if inside quiet window
  if (settings?.quiet_hours_enabled) {
    const tz = settings.timezone || 'UTC';
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
      // Invalid timezone — fall back to UTC
      const utcNow = new Date();
      nowHour = utcNow.getUTCHours();
      nowMinute = utcNow.getUTCMinutes();
    }

    const start = settings.quiet_hours_start as string | undefined; // e.g. "22:00"
    const end = settings.quiet_hours_end as string | undefined;     // e.g. "07:00"

    if (start && end) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const nowMins = nowHour * 60 + nowMinute;
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;

      const inQuietHours = startMins <= endMins
        ? nowMins >= startMins && nowMins < endMins           // same-day range (e.g. 01:00–06:00)
        : nowMins >= startMins || nowMins < endMins;          // overnight range (e.g. 22:00–07:00)

      if (inQuietHours) return 0;
    }
  }

  // Respect user notification preferences (default to true if no settings)
  const prefs = {
    refill_reminders: settings?.refill_reminders ?? true,
    appointment_reminders: settings?.appointment_reminders ?? true,
    lab_alerts: settings?.lab_alerts ?? true,
    claim_updates: settings?.claim_updates ?? true,
  };

  // Fetch all relevant data in parallel
  const [
    { data: medications },
    { data: appointments },
    { data: priorAuths },
    { data: labResults },
    { data: fsaHsa },
    { data: existingNotifs },
  ] = await Promise.all([
    prefs.refill_reminders ? admin.from('medications').select('*').eq('care_profile_id', profile.id) : Promise.resolve({ data: [] }),
    prefs.appointment_reminders ? admin.from('appointments').select('*').eq('care_profile_id', profile.id) : Promise.resolve({ data: [] }),
    prefs.claim_updates ? admin.from('prior_auths').select('*').eq('user_id', userId) : Promise.resolve({ data: [] }),
    prefs.lab_alerts ? admin.from('lab_results').select('*').eq('user_id', userId).eq('is_abnormal', true).order('created_at', { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    admin.from('fsa_hsa').select('*').eq('user_id', userId),
    // Get recent notifications to avoid duplicates (last 24 hours)
    admin.from('notifications').select('title, type').eq('user_id', userId).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const existingTitles = new Set((existingNotifs || []).map((n) => n.title));
  const now = new Date();

  const toInsert: Array<{ user_id: string; type: string; title: string; message: string }> = [];

  // ----------------------------------------------------------
  // 1. Medication refills due within 3 days
  // ----------------------------------------------------------
  for (const med of medications || []) {
    if (!med.refill_date) continue;
    const diff = Math.ceil((new Date(med.refill_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff <= 0) {
      const title = `${med.name} refill is overdue`;
      if (!existingTitles.has(title)) {
        toInsert.push({
          user_id: userId,
          type: 'refill_overdue',
          title,
          message: `The refill for ${med.name}${med.dose ? ` ${med.dose}` : ''} was due ${med.refill_date}. Contact the pharmacy or doctor to avoid a gap in medication.`,
        });
      }
    } else if (diff <= 3) {
      const title = `${med.name} refill due in ${diff} day${diff === 1 ? '' : 's'}`;
      if (!existingTitles.has(title)) {
        toInsert.push({
          user_id: userId,
          type: 'refill_soon',
          title,
          message: `${med.name}${med.dose ? ` ${med.dose}` : ''} refill is coming up on ${med.refill_date}. Would you like help contacting the pharmacy?`,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // 2. Appointments tomorrow — prep reminder
  // ----------------------------------------------------------
  for (const appt of appointments || []) {
    if (!appt.date_time) continue;
    const apptDate = new Date(appt.date_time);
    const diff = Math.ceil((apptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 1) {
      const title = `Appointment tomorrow with ${appt.doctor_name || 'your doctor'}`;
      if (!existingTitles.has(title)) {
        const time = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        toInsert.push({
          user_id: userId,
          type: 'appointment_prep',
          title,
          message: `${appt.doctor_name || 'Appointment'} at ${time}${appt.location ? ` — ${appt.location}` : ''}. ${appt.purpose ? `Purpose: ${appt.purpose}. ` : ''}Tap to ask CareCompanion to help you prepare questions.`,
        });
      }
    } else if (diff === 0) {
      const title = `Appointment today with ${appt.doctor_name || 'your doctor'}`;
      if (!existingTitles.has(title)) {
        const time = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        toInsert.push({
          user_id: userId,
          type: 'appointment_today',
          title,
          message: `Don't forget — ${appt.doctor_name || 'appointment'} at ${time} today.${appt.location ? ` Location: ${appt.location}` : ''}`,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // 3. Prior authorizations expiring within 14 days
  // ----------------------------------------------------------
  for (const auth of priorAuths || []) {
    if (!auth.expiry_date) continue;
    const diff = Math.ceil((new Date(auth.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff > 0 && diff <= 14) {
      const title = `Prior auth for ${auth.service} expires in ${diff} day${diff === 1 ? '' : 's'}`;
      if (!existingTitles.has(title)) {
        const sessionsInfo = auth.sessions_approved
          ? ` (${auth.sessions_used}/${auth.sessions_approved} sessions used)`
          : '';
        toInsert.push({
          user_id: userId,
          type: 'prior_auth_expiring',
          title,
          message: `Your prior authorization for ${auth.service} expires ${auth.expiry_date}${sessionsInfo}. Contact your insurance to request a renewal.`,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // 4. New abnormal lab results (created in last hour)
  // ----------------------------------------------------------
  for (const lab of labResults || []) {
    const createdAgo = (now.getTime() - new Date(lab.created_at).getTime()) / (1000 * 60 * 60);
    if (createdAgo <= 1) {
      const title = `Abnormal result: ${lab.test_name}`;
      if (!existingTitles.has(title)) {
        toInsert.push({
          user_id: userId,
          type: 'abnormal_lab',
          title,
          message: `${lab.test_name} came back at ${lab.value}${lab.unit ? ` ${lab.unit}` : ''} (normal range: ${lab.reference_range || 'not specified'}). Ask CareCompanion to explain what this means.`,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // 5. Low FSA/HSA balance (under 10% of limit)
  // ----------------------------------------------------------
  for (const account of fsaHsa || []) {
    if (!account.contribution_limit) continue;
    if (account.balance < account.contribution_limit * 0.1) {
      const title = `Low ${account.account_type.toUpperCase()} balance: $${account.balance}`;
      if (!existingTitles.has(title)) {
        toInsert.push({
          user_id: userId,
          type: 'low_balance',
          title,
          message: `Your ${account.account_type.toUpperCase()} with ${account.provider} has $${account.balance} remaining out of $${account.contribution_limit}.${account.account_type === 'fsa' ? ' FSA funds typically expire at year-end — plan your spending.' : ''}`,
        });
      }
    }
  }

  // Insert all new notifications
  if (toInsert.length > 0) {
    const { error } = await admin.from('notifications').insert(toInsert);
    if (!error) generated = toInsert.length;
  }

  return generated;
}

/**
 * Run notification generation for all users with care profiles.
 */
export async function generateNotificationsForAllUsers(): Promise<{ total: number; users: number }> {
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from('care_profiles')
    .select('user_id');

  if (!profiles || profiles.length === 0) return { total: 0, users: 0 };

  let total = 0;
  for (const p of profiles) {
    const count = await generateNotificationsForUser(p.user_id);
    total += count;
  }

  return { total, users: profiles.length };
}
