import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { db } from '@/lib/db';
import { appointments, careProfiles, medications, labResults, memories, symptomEntries, healthSummaries, treatmentCycles } from '@/lib/db/schema';
import { desc, eq, and, gte } from 'drizzle-orm';
import { getAuthenticatedUser, parseBody } from '@/lib/api-helpers';
import { detectVisitType, getVisitTemplate } from '@/lib/visit-prep-templates';
import { rateLimit } from '@/lib/rate-limit';
import { ApiErrors } from '@/lib/api-response';
import { withMetrics } from '@/lib/api-metrics';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 });

export const maxDuration = 30;

async function handler(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) return ApiErrors.rateLimited();

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return new Response('Unauthorized', { status: 401 });

  const { body, error: bodyError } = await parseBody<{ appointment_id?: string }>(req);
  if (bodyError) return bodyError;
  const { appointment_id } = body;
  if (!appointment_id) return Response.json({ error: 'appointment_id is required' }, { status: 400 });

  const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointment_id)).limit(1);
  if (!appt) return Response.json({ error: 'Appointment not found' }, { status: 404 });

  const [profile] = await db.select().from(careProfiles).where(eq(careProfiles.id, appt.careProfileId)).limit(1);
  if (!profile) return Response.json({ error: 'Care profile not found' }, { status: 404 });

  if (profile.userId !== dbUser!.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

  // Dedup: return cached prep sheet if one was generated < 24h ago for this appointment
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentSummaries = await db
    .select({ summary: healthSummaries.summary, createdAt: healthSummaries.createdAt })
    .from(healthSummaries)
    .where(and(eq(healthSummaries.userId, dbUser!.id), gte(healthSummaries.createdAt, oneDayAgo)))
    .orderBy(desc(healthSummaries.createdAt))
    .limit(20)
    .catch(() => []);

  const cached = recentSummaries.find(
    (s) => (s.summary as Record<string, unknown>)?.type === 'visit_prep' &&
            (s.summary as Record<string, unknown>)?.appointmentId === appointment_id,
  );
  if (cached) {
    return Response.json({ success: true, prep_sheet: (cached.summary as Record<string, unknown>).prep_sheet, cached: true });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [meds, labs, recentMemories, recentSymptoms, activeCycleRows] = await Promise.all([
    db.select().from(medications).where(eq(medications.careProfileId, profile.id)).catch(() => []),
    db.select().from(labResults)
      .where(and(eq(labResults.userId, dbUser!.id), gte(labResults.dateTaken, thirtyDaysAgo.toISOString().split('T')[0])))
      .orderBy(desc(labResults.dateTaken))
      .limit(15)
      .catch(() => []),
    db.select({ fact: memories.fact, category: memories.category })
      .from(memories)
      .where(eq(memories.userId, dbUser!.id))
      .orderBy(desc(memories.lastReferenced))
      .limit(20)
      .catch(() => []),
    db.select()
      .from(symptomEntries)
      .where(and(eq(symptomEntries.userId, dbUser!.id), gte(symptomEntries.createdAt, fourteenDaysAgo)))
      .orderBy(desc(symptomEntries.date))
      .limit(3)
      .catch(() => []),
    profile.id
      ? db.select().from(treatmentCycles)
          .where(and(eq(treatmentCycles.careProfileId, profile.id), eq(treatmentCycles.isActive, true)))
          .limit(1)
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const [activeCycle] = activeCycleRows;
  const abnormalLabs = labs.filter((l) => l.isAbnormal);
  const allSymptoms = Array.from(new Set(recentSymptoms.flatMap((s) => s.symptoms || []))).slice(0, 10);
  const avgPain = recentSymptoms.length > 0
    ? (recentSymptoms.reduce((sum, s) => sum + (s.painLevel || 0), 0) / recentSymptoms.length).toFixed(1)
    : null;
  const relevantMemories = recentMemories.map((m) => m.fact).join('\n- ');

  // Compute cycle day and nadir window from startDate + cycleLengthDays
  let cycleContext = '';
  if (activeCycle) {
    const cycleStart = new Date(activeCycle.startDate);
    const daysSinceStart = Math.floor((Date.now() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
    const cycleDay = (daysSinceStart % activeCycle.cycleLengthDays) + 1;
    const isNadirWindow = cycleDay >= 7 && cycleDay <= 14;
    cycleContext = `\nACTIVE TREATMENT CYCLE: ${activeCycle.regimenName || 'Active regimen'}, Cycle ${activeCycle.cycleNumber}, Day ${cycleDay} of ${activeCycle.cycleLengthDays}.`;
    if (isNadirWindow) {
      cycleContext += ' ⚠️ NADIR WINDOW — blood counts likely at their lowest this cycle. Watch for fever ≥100.4°F, infection signs, unusual bruising.';
    }
  }

  const visitType = detectVisitType(appt.purpose, appt.specialty);
  const template = getVisitTemplate(visitType);

  // Dynamic bring list: base + visit-type-specific + patient-data-conditional
  const isImagingAppt = (appt.purpose || '').toLowerCase().match(/imaging|ct |mri |pet |x-ray|xray/);
  const bringContext = [
    'BASE (always bring):',
    '- Photo ID and insurance card',
    '- Current medication list with dosages',
    '- List of known allergies',
    visitType === 'infusion' ? '- Snacks and water\n- Warm blanket or jacket (infusion centers are cold)\n- Headphones / entertainment\n- Confirmed ride home\n- Anti-nausea medication in case needed on the way back' : '',
    isImagingAppt ? '- Contrast prep instructions if ordered\n- Remove metal jewelry before arriving\n- Arrive 15 minutes early for paperwork' : '',
    labs.length > 0 ? '- Recent lab results may be ready — ask at check-in if you haven\'t received them' : '',
    'TEMPLATE ITEMS:',
    ...template.things_to_bring.map((t) => `- ${t}`),
  ].filter(Boolean).join('\n');

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    prompt: `Generate a doctor visit prep sheet. Format as clean markdown a caregiver can print or share.

APPOINTMENT:
- Doctor: ${appt.doctorName || 'Unknown'}
- Specialty: ${appt.specialty || 'General'}
- Date: ${appt.dateTime ? new Date(appt.dateTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD'}
- Purpose: ${appt.purpose || 'General visit'}
- Location: ${appt.location || 'Not specified'}
- Visit type: ${template.label}
${cycleContext}

PATIENT:
- Name: ${profile.patientName || 'Unknown'}
- Age: ${profile.patientAge || 'Unknown'}
- Conditions: ${profile.conditions || 'None listed'}
- Allergies: ${profile.allergies || 'None listed'}

CURRENT MEDICATIONS (${meds.length}):
${meds.map((m) => `- ${m.name} ${m.dose || ''} ${m.frequency || ''} (prescribed by ${m.prescribingDoctor || 'unknown'})`).join('\n') || '- None listed'}

RECENT LAB RESULTS (last 30 days — ${labs.length} results):
${abnormalLabs.length > 0 ? `⚠️ ABNORMAL VALUES: ${abnormalLabs.map((l) => `${l.testName}: ${l.value}${l.unit || ''}`).join(', ')}` : 'No abnormal results in last 30 days'}
${labs.map((l) => `- ${l.testName}: ${l.value} ${l.unit || ''} (range: ${l.referenceRange || 'N/A'})${l.isAbnormal ? ' ⚠️' : ''} [${l.dateTaken || 'no date'}]`).join('\n') || '- No recent labs'}

RECENT SYMPTOMS (last 14 days, last 3 check-ins):
${allSymptoms.length > 0 ? allSymptoms.join(', ') : 'None logged'}
${avgPain ? `Average pain level: ${avgPain}/10` : ''}
${recentSymptoms[0]?.notes ? `Most recent caregiver note: "${recentSymptoms[0].notes}"` : ''}

NOTES FROM PAST CONVERSATIONS (what the caregiver has shared recently):
- ${relevantMemories || 'None'}

WHAT TO BRING:
${bringContext}

PREP TASKS:
${template.prep_tasks.map((t) => `- ${t}`).join('\n')}

Generate the prep sheet with these exact sections:

1. **Patient Summary** — one paragraph with the key context the doctor needs. Include diagnosis, current treatment phase, any active cycle/nadir info, and the most pressing issues from recent symptoms or labs.

2. **Current Medications** — clean table with columns: Medication | Dose | Frequency | Prescribing Doctor. Flag any medications directly relevant to this appointment type.

3. **Recent Lab Results** — list all results from the last 30 days. For any abnormal value, add a plain-English note explaining what the value means clinically (e.g. "Low ANC means reduced ability to fight infection").

4. **Questions to Ask** — generate exactly 6 questions. These must be specific to THIS patient's actual situation. Reference their conditions, current medications, recent symptoms, and abnormal lab values by name. Do not use generic questions. Each question should be something a caregiver would not think to ask without this data.

5. **What to Bring** — formatted checklist using the items above. Add any additional items specific to this patient's situation that aren't already listed.

6. **After the Visit — What to Record** — include these 3 prompts exactly:
${template.post_visit_prompts.map((p, i) => `   ${i + 1}. ${p}`).join('\n')}

7. **Notes** — blank lined section for writing during the visit.

Tone: warm but practical. Written for a family caregiver, not a clinician. Avoid jargon without explanation.`,
  });

  // Save to healthSummaries so repeat requests return cached version
  await db.insert(healthSummaries).values({
    userId: dbUser!.id,
    careProfileId: profile.id,
    summary: { type: 'visit_prep', appointmentId: appointment_id, prep_sheet: text, generatedAt: new Date().toISOString() },
  }).catch(() => {});

  return Response.json({ success: true, prep_sheet: text });
}

export const POST = withMetrics('/api/visit-prep', handler);
