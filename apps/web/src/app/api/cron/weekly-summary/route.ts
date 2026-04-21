/**
 * Cron: Auto-generate weekly family update summaries.
 *
 * Runs every Sunday at 8am UTC.
 * For each user with a completed care profile:
 *   1. Pulls last 7 days of data (symptoms, med adherence, labs, upcoming appts)
 *   2. Generates a warm, human-readable AI narrative via Claude
 *   3. Creates a SharedLink with type 'weekly_summary' (14-day expiry)
 *   4. Sends a push notification to the caregiver
 *   5. Creates an in-app notification
 */

import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { verifyCronRequest } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import {
  careProfiles, symptomEntries, reminderLogs,
  appointments, labResults, sharedLinks, notifications, pushSubscriptions,
} from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { sendPushNotification } from '@/lib/push';
import { logger } from '@/lib/logger';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authError = verifyCronRequest(req);
  if (authError) return authError;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Only process users with a completed onboarding
  const profiles = await db
    .select({
      id: careProfiles.id,
      userId: careProfiles.userId,
      patientName: careProfiles.patientName,
      cancerType: careProfiles.cancerType,
      cancerStage: careProfiles.cancerStage,
      treatmentPhase: careProfiles.treatmentPhase,
      relationship: careProfiles.relationship,
    })
    .from(careProfiles)
    .where(eq(careProfiles.onboardingCompleted, true));

  if (profiles.length === 0) return Response.json({ message: 'No profiles', summaries: 0 });

  let generated = 0;
  const errors: string[] = [];

  for (const profile of profiles) {
    try {
      // Fetch last 7 days of data in parallel
      const [symptoms, medLogs, upcomingAppts, recentLabs] = await Promise.all([
        db.select().from(symptomEntries)
          .where(and(
            eq(symptomEntries.userId, profile.userId),
            gte(symptomEntries.createdAt, sevenDaysAgo),
          ))
          .orderBy(desc(symptomEntries.date))
          .limit(14),

        db.select().from(reminderLogs)
          .where(and(
            eq(reminderLogs.userId, profile.userId),
            gte(reminderLogs.scheduledTime, sevenDaysAgo),
          ))
          .limit(50),

        db.select({
          doctorName: appointments.doctorName,
          specialty: appointments.specialty,
          dateTime: appointments.dateTime,
          purpose: appointments.purpose,
          location: appointments.location,
        }).from(appointments)
          .where(and(
            eq(appointments.careProfileId, profile.id),
            gte(appointments.dateTime, now),
            lte(appointments.dateTime, sevenDaysAhead),
          ))
          .orderBy(appointments.dateTime)
          .limit(5),

        db.select({
          testName: labResults.testName,
          value: labResults.value,
          unit: labResults.unit,
          isAbnormal: labResults.isAbnormal,
          dateTaken: labResults.dateTaken,
        }).from(labResults)
          .where(and(
            eq(labResults.userId, profile.userId),
            gte(labResults.createdAt, sevenDaysAgo),
          ))
          .orderBy(desc(labResults.dateTaken))
          .limit(10),
      ]);

      // Build adherence stats
      const totalReminders = medLogs.length;
      const takenReminders = medLogs.filter(l => l.status === 'taken').length;
      const adherenceRate = totalReminders > 0 ? Math.round((takenReminders / totalReminders) * 100) : null;

      // Build symptom summary
      const avgPain = symptoms.length > 0
        ? (symptoms.reduce((sum, s) => sum + (s.painLevel || 0), 0) / symptoms.length).toFixed(1)
        : null;
      const symptomList = Array.from(new Set(symptoms.flatMap(s => s.symptoms || []))).slice(0, 8);

      // Generate AI narrative
      const { text: narrative } = await generateText({
        model: anthropic('claude-haiku-4.5'),
        prompt: `You are writing a warm, caring weekly update for a cancer caregiver to share with their family about how their loved one is doing.

Write 2-3 short paragraphs in a warm, human tone. Focus on what's going well, acknowledge challenges honestly but gently, and end on a note of strength. Do NOT include medical advice. Do NOT use clinical language. Write as if a thoughtful friend is summarizing the week. Do NOT use markdown, just plain paragraphs.

PATIENT: ${profile.patientName || 'the patient'} (${profile.cancerType || 'cancer'} ${profile.cancerStage ? `- ${profile.cancerStage}` : ''})
CAREGIVER RELATIONSHIP: ${profile.relationship || 'caregiver'}
TREATMENT PHASE: ${profile.treatmentPhase || 'active treatment'}

THIS WEEK'S DATA:
- Symptom logs this week: ${symptoms.length} entries
- Common symptoms reported: ${symptomList.length > 0 ? symptomList.join(', ') : 'none logged'}
- Average pain level: ${avgPain !== null ? `${avgPain}/10` : 'not tracked'}
- Medication adherence: ${adherenceRate !== null ? `${adherenceRate}% (${takenReminders}/${totalReminders} doses taken)` : 'not tracked'}
- New lab results: ${recentLabs.length > 0 ? recentLabs.map(l => `${l.testName}: ${l.value}${l.unit || ''}${l.isAbnormal ? ' (flagged)' : ''}`).join(', ') : 'none this week'}
- Upcoming appointments: ${upcomingAppts.length > 0 ? upcomingAppts.map(a => `${a.purpose || a.specialty || 'appointment'} with ${a.doctorName || 'doctor'} on ${a.dateTime}`).join(', ') : 'none this week'}

Keep it to 3 paragraphs max. Warm, real, human.`,
      });

      // Create shared link (14-day expiry)
      const token = randomUUID().replace(/-/g, '').slice(0, 20);
      const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const weekLabel = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      await db.insert(sharedLinks).values({
        userId: profile.userId,
        careProfileId: profile.id,
        token,
        type: 'weekly_summary',
        title: `Week of ${weekLabel} — ${profile.patientName || 'Update'}`,
        data: {
          narrative,
          patientName: profile.patientName,
          cancerType: profile.cancerType,
          treatmentPhase: profile.treatmentPhase,
          weekOf: weekLabel,
          stats: {
            symptomDays: symptoms.length,
            adherenceRate,
            commonSymptoms: symptomList,
            avgPain,
            newLabs: recentLabs.length,
            upcomingAppointments: upcomingAppts.map(a => ({
              doctorName: a.doctorName,
              specialty: a.specialty,
              dateTime: a.dateTime,
              purpose: a.purpose,
            })),
          },
        },
        expiresAt,
      });

      const shareUrl = `/shared/${token}`;

      // Create in-app notification
      await db.insert(notifications).values({
        userId: profile.userId,
        type: 'weekly_summary',
        title: `Your weekly update for ${profile.patientName || 'your loved one'} is ready`,
        message: `Share this week's care update with family. Tap to preview and share the link: /shared/${token}`,
        isRead: false,
      });

      // Send push notification (fire and forget)
      const subs = await db.select().from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, profile.userId))
        .limit(5);

      for (const sub of subs) {
        sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          {
            title: 'Weekly update ready to share',
            body: `This week's update for ${profile.patientName || 'your loved one'} is ready. Tap to preview and share with family.`,
            url: shareUrl,
          },
        ).catch(() => { /* expired subscriptions are fine */ });
      }

      generated++;
      logger.info('weekly_summary_generated', { userId: profile.userId, token });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${profile.userId}: ${msg}`);
      logger.error('weekly_summary_failed', { userId: profile.userId, error: msg });
    }
  }

  return Response.json({ summaries: generated, users: profiles.length, errors });
}
