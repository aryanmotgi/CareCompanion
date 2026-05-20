/**
 * Cron: Nadir Summary Ready Notification.
 *
 * Runs daily. For every active treatment cycle where today is day 15
 * (the day after nadir ends), pushes a notification to all care group
 * members with a link to /nadir-summary/[cycleId]. Once per cycle per
 * user (deduped via notificationDeliveries category='nadir_summary'
 * since cycle.startDate).
 */

import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import {
  careProfiles,
  treatmentCycles,
  careGroupMembers,
  pushSubscriptions,
  notificationDeliveries,
} from '@/lib/db/schema';
import { eq, and, gte, inArray } from 'drizzle-orm';
import { sendPushNotification } from '@/lib/push';
import { logger } from '@/lib/logger';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function computeDayOfCycle(startDate: string): number {
  const startMs = new Date(startDate + 'T00:00:00').getTime();
  const todayMs = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  return Math.floor((todayMs - startMs) / 86400000) + 1;
}

export async function GET(req: Request) {
  const authError = verifyCronRequest(req);
  if (authError) return authError;

  try {
    const activeCycles = await db
      .select({
        cycleId: treatmentCycles.id,
        cycleNumber: treatmentCycles.cycleNumber,
        startDate: treatmentCycles.startDate,
        cycleLengthDays: treatmentCycles.cycleLengthDays,
        careProfileId: treatmentCycles.careProfileId,
        patientUserId: careProfiles.userId,
        patientName: careProfiles.patientName,
      })
      .from(treatmentCycles)
      .innerJoin(careProfiles, eq(careProfiles.id, treatmentCycles.careProfileId))
      .where(eq(treatmentCycles.isActive, true));

    let cyclesMatched = 0;
    let notificationsSent = 0;
    let notificationsSkipped = 0;
    const errors: string[] = [];

    for (const cycle of activeCycles) {
      const dayOfCycle = computeDayOfCycle(cycle.startDate);
      if (dayOfCycle !== 15) continue;
      if (dayOfCycle > cycle.cycleLengthDays) continue;
      cyclesMatched++;

      try {
        const [patientMembership] = await db
          .select({ careGroupId: careGroupMembers.careGroupId })
          .from(careGroupMembers)
          .where(eq(careGroupMembers.userId, cycle.patientUserId))
          .limit(1);

        if (!patientMembership) {
          logger.warn('nadir_summary_no_care_group', {
            careProfileId: cycle.careProfileId,
            patientUserId: cycle.patientUserId,
          });
          continue;
        }

        const members = await db
          .select({ userId: careGroupMembers.userId })
          .from(careGroupMembers)
          .where(eq(careGroupMembers.careGroupId, patientMembership.careGroupId));

        const memberUserIds = members.map((m) => m.userId);
        if (memberUserIds.length === 0) continue;

        const cycleStartTs = new Date(cycle.startDate + 'T00:00:00');
        const existingDeliveries = await db
          .select({ userId: notificationDeliveries.userId })
          .from(notificationDeliveries)
          .where(and(
            eq(notificationDeliveries.careProfileId, cycle.careProfileId),
            eq(notificationDeliveries.category, 'nadir_summary'),
            gte(notificationDeliveries.sentAt, cycleStartTs),
            inArray(notificationDeliveries.userId, memberUserIds),
          ));
        const alreadyNotified = new Set(existingDeliveries.map((d) => d.userId));

        const recipientIds = memberUserIds.filter((uid) => !alreadyNotified.has(uid));
        if (recipientIds.length === 0) {
          notificationsSkipped += memberUserIds.length;
          continue;
        }

        const subs = await db
          .select({
            userId: pushSubscriptions.userId,
            endpoint: pushSubscriptions.endpoint,
            p256dh: pushSubscriptions.p256dh,
            auth: pushSubscriptions.auth,
          })
          .from(pushSubscriptions)
          .where(inArray(pushSubscriptions.userId, recipientIds));

        const subsByUser = new Map<string, typeof subs>();
        for (const sub of subs) {
          const arr = subsByUser.get(sub.userId) ?? [];
          arr.push(sub);
          subsByUser.set(sub.userId, arr);
        }

        const patientLabel = cycle.patientName?.trim() || 'Your loved one';
        const title = `Nadir week recap ready · Cycle ${cycle.cycleNumber}`;
        const body = `See how ${patientLabel} did during nadir — tap to view and share.`;
        const url = `/nadir-summary/${cycle.cycleId}`;

        for (const userId of recipientIds) {
          try {
            await db.insert(notificationDeliveries).values({
              userId,
              careProfileId: cycle.careProfileId,
              category: 'nadir_summary',
              title,
            });
            notificationsSent++;

            const userSubs = (subsByUser.get(userId) ?? []).slice(0, 5);
            for (const sub of userSubs) {
              sendPushNotification(
                { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                { title, body, url },
              ).catch(() => { /* expired subscriptions handled elsewhere */ });
            }
          } catch (userErr) {
            const msg = userErr instanceof Error ? userErr.message : String(userErr);
            errors.push(`user ${userId}: ${msg}`);
            logger.error('nadir_summary_user_failed', { userId, error: msg });
          }
        }
      } catch (cycleErr) {
        const msg = cycleErr instanceof Error ? cycleErr.message : String(cycleErr);
        errors.push(`cycle ${cycle.cycleId}: ${msg}`);
        logger.error('nadir_summary_cycle_failed', { cycleId: cycle.cycleId, error: msg });
      }
    }

    logger.info('nadir_summary_done', {
      activeCycles: activeCycles.length,
      cyclesMatched,
      notificationsSent,
      notificationsSkipped,
      errors: errors.length,
    });

    return NextResponse.json({
      ok: true,
      active_cycles: activeCycles.length,
      cycles_matched: cyclesMatched,
      notifications_sent: notificationsSent,
      notifications_skipped: notificationsSkipped,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('nadir_summary_failed', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
