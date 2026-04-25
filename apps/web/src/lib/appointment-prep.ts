/**
 * Auto appointment prep generator.
 *
 * Given a userId and appointmentId, fetches all relevant context and calls Claude
 * to generate a personalized visit prep sheet:
 *   - Questions to ask the doctor
 *   - Things to report (symptoms, medication issues)
 *   - Things to bring
 *
 * Result is stored in `health_summaries` with type 'appointment_prep'
 * so it can be surfaced in the visit-prep page.
 */

import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { db } from '@/lib/db';
import {
  appointments, careProfiles, medications, symptomEntries,
  labResults, healthSummaries,
} from '@/lib/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';

interface AppointmentPrepResult {
  appointmentId: string;
  doctorName: string | null;
  specialty: string | null;
  dateTime: string | null;
  questions: string[];
  thingsToReport: string[];
  thingsToBring: string[];
  generatedAt: string;
}

export async function generateAppointmentPrepForUser(
  userId: string,
  appointmentId: string,
): Promise<AppointmentPrepResult | null> {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch appointment + profile first, then fetch the rest in parallel
    const [[appt], [profile]] = await Promise.all([
      db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1),
      db.select().from(careProfiles).where(eq(careProfiles.userId, userId)).limit(1),
    ]);

    if (!appt) return null;

    const profileId = profile?.id;

    const [medsData, symptoms, labs] = await Promise.all([
      profileId
        ? db.select({ name: medications.name, dose: medications.dose, frequency: medications.frequency, notes: medications.notes })
            .from(medications).where(eq(medications.careProfileId, profileId))
        : Promise.resolve([]),

      db.select({ date: symptomEntries.date, painLevel: symptomEntries.painLevel, symptoms: symptomEntries.symptoms, notes: symptomEntries.notes })
        .from(symptomEntries)
        .where(and(eq(symptomEntries.userId, userId), gte(symptomEntries.createdAt, fourteenDaysAgo)))
        .orderBy(desc(symptomEntries.date))
        .limit(10),

      db.select({ testName: labResults.testName, value: labResults.value, unit: labResults.unit, isAbnormal: labResults.isAbnormal, dateTaken: labResults.dateTaken })
        .from(labResults)
        .where(and(eq(labResults.userId, userId), gte(labResults.createdAt, thirtyDaysAgo)))
        .orderBy(desc(labResults.dateTaken))
        .limit(15),
    ]);

    const abnormalLabs = labs.filter(l => l.isAbnormal);
    const recentSymptoms = Array.from(new Set(symptoms.flatMap(s => s.symptoms || []))).slice(0, 8);
    const avgPain = symptoms.length > 0
      ? (symptoms.reduce((sum, s) => sum + (s.painLevel || 0), 0) / symptoms.length).toFixed(1)
      : null;

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt: `You are helping a cancer caregiver prepare for a medical appointment. Generate a practical, specific prep sheet.

APPOINTMENT: ${appt.purpose || appt.specialty || 'Medical appointment'} with ${appt.doctorName || 'doctor'} (${appt.specialty || ''})
PATIENT: ${profile?.patientName || 'patient'} — ${profile?.cancerType || 'cancer'} ${profile?.cancerStage ? `(${profile.cancerStage})` : ''}, ${profile?.treatmentPhase || 'active treatment'}

CURRENT MEDICATIONS (${medsData.length}):
${medsData.map(m => `- ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? `, ${m.frequency}` : ''}${m.notes ? ` (${m.notes})` : ''}`).join('\n') || 'None logged'}

RECENT SYMPTOMS (last 14 days):
${recentSymptoms.length > 0 ? recentSymptoms.join(', ') : 'None logged'}
${avgPain ? `Average pain level: ${avgPain}/10` : ''}
${symptoms[0]?.notes ? `Most recent notes: "${symptoms[0].notes}"` : ''}

RECENT LAB RESULTS (last 30 days):
${abnormalLabs.length > 0 ? `Abnormal: ${abnormalLabs.map(l => `${l.testName}: ${l.value}${l.unit || ''}`).join(', ')}` : 'No abnormal results'}
${labs.length > 0 ? `Total results: ${labs.length}` : 'No recent labs'}

Generate EXACTLY this JSON (no markdown, no explanation, just the JSON):
{
  "questions": ["specific question 1", "specific question 2", "specific question 3", "specific question 4", "specific question 5"],
  "thingsToReport": ["thing 1", "thing 2", "thing 3"],
  "thingsToBring": ["item 1", "item 2", "item 3"]
}

Make questions specific to this patient's situation — not generic. Reference their cancer type, current treatment, and recent symptoms where relevant.`,
    });

    // Parse Claude's response
    let parsed: { questions: string[]; thingsToReport: string[]; thingsToBring: string[] };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] || text);
    } catch {
      // Fallback if JSON parsing fails
      parsed = {
        questions: ['What are my current lab results showing?', 'Are there any medication adjustments needed?', 'What side effects should I watch for?'],
        thingsToReport: ['Recent symptoms and pain levels', 'Any missed medications', 'Questions from family members'],
        thingsToBring: ['Current medication list', 'Recent lab results', 'List of symptoms from the past 2 weeks'],
      };
    }

    const result: AppointmentPrepResult = {
      appointmentId,
      doctorName: appt.doctorName,
      specialty: appt.specialty,
      dateTime: appt.dateTime ? String(appt.dateTime) : null,
      questions: parsed.questions || [],
      thingsToReport: parsed.thingsToReport || [],
      thingsToBring: parsed.thingsToBring || [],
      generatedAt: new Date().toISOString(),
    };

    // Store in health_summaries for retrieval by visit-prep page
    if (profileId) {
      await db.insert(healthSummaries).values({
        userId,
        careProfileId: profileId,
        summary: { type: 'appointment_prep', ...result },
      });
    }

    logger.info('appointment_prep_generated', { userId, appointmentId });
    return result;
  } catch (err) {
    logger.error('appointment_prep_failed', { userId, appointmentId, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
