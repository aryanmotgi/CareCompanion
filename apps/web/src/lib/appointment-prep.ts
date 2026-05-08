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
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  appointments, careProfiles, medications, symptomEntries,
  labResults, healthSummaries, memories, treatmentCycles,
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

const prepSchema = z.object({
  questions: z.array(z.string()).describe('5 specific questions tailored to this patient\'s conditions, medications, and recent symptoms. Not generic.'),
  thingsToReport: z.array(z.string()).describe('3-5 things the caregiver should proactively tell the doctor at this visit'),
  thingsToBring: z.array(z.string()).describe('3-5 items to bring to this specific appointment'),
});

export async function generateAppointmentPrepForUser(
  userId: string,
  appointmentId: string,
): Promise<AppointmentPrepResult | null> {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [[appt], [profile]] = await Promise.all([
      db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1),
      db.select().from(careProfiles).where(eq(careProfiles.userId, userId)).limit(1),
    ]);

    if (!appt) return null;

    const profileId = profile?.id;

    const [medsData, symptoms, labs, recentMemories, activeCycleRows] = await Promise.all([
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

      db.select({ fact: memories.fact, category: memories.category })
        .from(memories)
        .where(eq(memories.userId, userId))
        .orderBy(desc(memories.lastReferenced))
        .limit(15),

      profileId
        ? db.select().from(treatmentCycles)
            .where(and(eq(treatmentCycles.careProfileId, profileId), eq(treatmentCycles.isActive, true)))
            .limit(1)
        : Promise.resolve([]),
    ]);

    const [activeCycle] = activeCycleRows;
    const abnormalLabs = labs.filter(l => l.isAbnormal);
    const recentSymptoms = Array.from(new Set(symptoms.flatMap(s => s.symptoms || []))).slice(0, 8);
    const avgPain = symptoms.length > 0
      ? (symptoms.reduce((sum, s) => sum + (s.painLevel || 0), 0) / symptoms.length).toFixed(1)
      : null;
    const memoryContext = recentMemories.map(m => `[${m.category}] ${m.fact}`).join('\n');

    // Compute cycle day and nadir window
    let cycleContext = '';
    if (activeCycle) {
      const cycleStart = new Date(activeCycle.startDate);
      const daysSinceStart = Math.floor((Date.now() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
      const cycleDay = (daysSinceStart % activeCycle.cycleLengthDays) + 1;
      const isNadirWindow = cycleDay >= 7 && cycleDay <= 14;
      cycleContext = `\nTREATMENT CYCLE: ${activeCycle.regimenName || 'Active regimen'}, Cycle ${activeCycle.cycleNumber}, Day ${cycleDay} of ${activeCycle.cycleLengthDays}.`;
      if (isNadirWindow) cycleContext += ' Patient is in nadir window — blood counts at lowest point.';
    }

    const { output } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      output: Output.object({ schema: prepSchema }),
      prompt: `You are helping a cancer caregiver prepare for a medical appointment. Generate specific, personalized prep content based on this patient's actual data.

APPOINTMENT: ${appt.purpose || appt.specialty || 'Medical appointment'} with ${appt.doctorName || 'doctor'} (${appt.specialty || ''})
PATIENT: ${profile?.patientName || 'patient'} — ${profile?.cancerType || 'cancer'} ${profile?.cancerStage ? `(${profile.cancerStage})` : ''}, ${profile?.treatmentPhase || 'active treatment'}
${cycleContext}

CURRENT MEDICATIONS (${medsData.length}):
${medsData.map(m => `- ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? `, ${m.frequency}` : ''}${m.notes ? ` (${m.notes})` : ''}`).join('\n') || 'None logged'}

RECENT SYMPTOMS (last 14 days):
${recentSymptoms.length > 0 ? recentSymptoms.join(', ') : 'None logged'}
${avgPain ? `Average pain level: ${avgPain}/10` : ''}
${symptoms[0]?.notes ? `Most recent notes: "${symptoms[0].notes}"` : ''}

RECENT LAB RESULTS (last 30 days):
${abnormalLabs.length > 0 ? `⚠️ ABNORMAL: ${abnormalLabs.map(l => `${l.testName}: ${l.value}${l.unit || ''}`).join(', ')}` : 'No abnormal results'}
${labs.length > 0 ? labs.map(l => `- ${l.testName}: ${l.value}${l.unit || ''}${l.isAbnormal ? ' ⚠️' : ''}`).join('\n') : 'No recent labs'}

NOTES FROM PAST CONVERSATIONS:
${memoryContext || 'None'}

Generate:
- questions: 5 specific questions for THIS patient. Reference their cancer type, medications, recent symptoms, and abnormal labs by name. Not generic questions.
- thingsToReport: 3-5 things the caregiver should proactively tell the doctor — symptoms, side effects, concerns from the memory notes above.
- thingsToBring: 3-5 items relevant to this specific visit type and patient situation.`,
    });

    const result: AppointmentPrepResult = {
      appointmentId,
      doctorName: appt.doctorName,
      specialty: appt.specialty,
      dateTime: appt.dateTime ? String(appt.dateTime) : null,
      questions: output.questions || [],
      thingsToReport: output.thingsToReport || [],
      thingsToBring: output.thingsToBring || [],
      generatedAt: new Date().toISOString(),
    };

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
