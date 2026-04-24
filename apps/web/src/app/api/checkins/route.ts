import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { db } from '@/lib/db';
import {
  wellnessCheckins,
  careProfiles,
  careTeamMembers,
  careTeamActivityLog,
  notificationDeliveries,
  pushSubscriptions,
} from '@/lib/db/schema';
import { eq, and, sql, gte, desc } from 'drizzle-orm';
import { validateCheckin, sanitizeNotes } from '@/lib/checkin-validation';
import { sendPushNotification } from '@/lib/push';

export const dynamic = 'force-dynamic';

// POST — submit a wellness check-in
export async function POST(req: NextRequest) {
  const { user: dbUser, error: authError } = await getAuthenticatedUser();
  if (authError || !dbUser) return authError ?? apiError('Unauthorized', 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid or missing JSON body', 400);
  }

  const { careProfileId, ...checkinData } = body as {
    careProfileId: string;
    mood: number;
    pain: number;
    energy: string;
    sleep: string;
    notes?: string;
  };

  if (!careProfileId) {
    return apiError('careProfileId is required', 400);
  }

  // Validate check-in fields
  const validation = validateCheckin(checkinData);
  if (!validation.success) {
    const message = validation.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    return apiError('Validation error', 400, { details: message });
  }

  const parsed = validation.data;

  // Sanitize notes if provided
  if (parsed.notes) {
    parsed.notes = sanitizeNotes(parsed.notes);
  }

  // Look up the care profile
  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(eq(careProfiles.id, careProfileId))
    .limit(1);

  if (!profile) {
    return apiError('Care profile not found', 404);
  }

  // Proxy check: if the profile owner is not the current user, verify editor/owner role
  const isProxy = profile.userId !== dbUser.id;
  if (isProxy) {
    const [membership] = await db
      .select()
      .from(careTeamMembers)
      .where(
        and(
          eq(careTeamMembers.careProfileId, careProfileId),
          eq(careTeamMembers.userId, dbUser.id)
        )
      )
      .limit(1);

    if (!membership || !['editor', 'owner'].includes(membership.role)) {
      return apiError('Forbidden', 403);
    }
  }

  // Check for duplicate today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [existing] = await db
    .select({ id: wellnessCheckins.id })
    .from(wellnessCheckins)
    .where(
      and(
        eq(wellnessCheckins.careProfileId, careProfileId),
        gte(wellnessCheckins.checkedInAt, todayStart)
      )
    )
    .limit(1);

  if (existing) {
    return apiError('Already checked in today', 409);
  }

  // Insert check-in
  const [checkin] = await db
    .insert(wellnessCheckins)
    .values({
      careProfileId,
      reportedByUserId: dbUser.id,
      mood: parsed.mood,
      pain: parsed.pain,
      energy: parsed.energy,
      sleep: parsed.sleep,
      notes: parsed.notes ?? null,
    })
    .returning();

  // Calculate streak: count consecutive days backward from today
  const recentCheckins = await db
    .select({ checkedInAt: wellnessCheckins.checkedInAt })
    .from(wellnessCheckins)
    .where(eq(wellnessCheckins.careProfileId, careProfileId))
    .orderBy(desc(wellnessCheckins.checkedInAt))
    .limit(365);

  let streak = 0;
  const now = new Date();
  const expectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const row of recentCheckins) {
    const checkinDate = new Date(row.checkedInAt);
    const checkinDay = new Date(
      checkinDate.getFullYear(),
      checkinDate.getMonth(),
      checkinDate.getDate()
    );

    if (checkinDay.getTime() === expectedDate.getTime()) {
      streak++;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else if (checkinDay.getTime() < expectedDate.getTime()) {
      break;
    }
    // Skip duplicates on the same day
  }

  // Update streak on care profile
  await db
    .update(careProfiles)
    .set({ checkinStreak: streak })
    .where(eq(careProfiles.id, careProfileId));

  // Log activity
  await db.insert(careTeamActivityLog).values({
    careProfileId,
    userId: dbUser.id,
    action: 'completed_checkin',
    metadata: { mood: parsed.mood, pain: parsed.pain },
  });

  // Threshold alerts: pain >= 7, mood === 1, or (energy === 'low' && pain >= 5)
  const alerts: { title: string; body: string }[] = [];

  if (parsed.pain >= 7) {
    alerts.push({
      title: 'High Pain Alert',
      body: `${profile.patientName ?? 'Patient'} reported pain level ${parsed.pain}/10.`,
    });
  }
  if (parsed.mood === 1) {
    alerts.push({
      title: 'Low Mood Alert',
      body: `${profile.patientName ?? 'Patient'} reported very low mood (1/5).`,
    });
  }
  if (parsed.energy === 'low' && parsed.pain >= 5) {
    alerts.push({
      title: 'Low Energy + Pain Alert',
      body: `${profile.patientName ?? 'Patient'} reported low energy with pain level ${parsed.pain}/10.`,
    });
  }

  if (alerts.length > 0) {
    // Find caregivers for this profile
    const caregivers = await db
      .select({ userId: careTeamMembers.userId })
      .from(careTeamMembers)
      .where(eq(careTeamMembers.careProfileId, careProfileId));

    const caregiverUserIds = caregivers
      .map((c) => c.userId)
      .filter((id) => id !== dbUser.id);

    if (caregiverUserIds.length > 0) {
      // Get push subscriptions for caregivers
      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(
          sql`${pushSubscriptions.userId} IN (${sql.join(
            caregiverUserIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );

      for (const alert of alerts) {
        // Send push to each subscription
        for (const sub of subscriptions) {
          try {
            await sendPushNotification(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              { title: alert.title, body: alert.body, url: '/dashboard' }
            );
          } catch {
            // Subscription may be expired — continue
          }
        }

        // Log notification deliveries for each caregiver
        for (const userId of caregiverUserIds) {
          await db.insert(notificationDeliveries).values({
            userId,
            careProfileId,
            category: 'threshold_alert',
            title: alert.title,
          });
        }
      }
    }
  }

  return apiSuccess({ checkin, streak }, 201);
}

// GET — get today's check-in and streak
export async function GET(req: NextRequest) {
  const { user: dbUser, error: authError } = await getAuthenticatedUser();
  if (authError || !dbUser) return authError ?? apiError('Unauthorized', 401);

  const careProfileId = req.nextUrl.searchParams.get('careProfileId');
  if (!careProfileId) {
    return apiError('careProfileId query parameter is required', 400);
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayCheckin, profile] = await Promise.all([
    db
      .select()
      .from(wellnessCheckins)
      .where(
        and(
          eq(wellnessCheckins.careProfileId, careProfileId),
          gte(wellnessCheckins.checkedInAt, todayStart)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ checkinStreak: careProfiles.checkinStreak })
      .from(careProfiles)
      .where(eq(careProfiles.id, careProfileId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  return apiSuccess({
    checkin: todayCheckin,
    streak: profile?.checkinStreak ?? 0,
  });
}
