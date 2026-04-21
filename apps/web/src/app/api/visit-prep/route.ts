import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { db } from '@/lib/db';
import { appointments, careProfiles, medications, labResults, memories } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { getAuthenticatedUser, parseBody } from '@/lib/api-helpers';
import { detectVisitType, getVisitTemplate } from '@/lib/visit-prep-templates';
import { rateLimit } from '@/lib/rate-limit';
import { ApiErrors } from '@/lib/api-response';
import { withMetrics } from '@/lib/api-metrics';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 });

export const maxDuration = 30;

// POST — generate a structured visit prep sheet for an appointment
async function handler(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) {
    return ApiErrors.rateLimited();
  }

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return new Response('Unauthorized', { status: 401 });

  const { body, error: bodyError } = await parseBody<{ appointment_id?: string }>(req);
  if (bodyError) return bodyError;
  const { appointment_id } = body;
  if (!appointment_id) return Response.json({ error: 'appointment_id is required' }, { status: 400 });

  // Get the appointment
  const [appt] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointment_id))
    .limit(1);

  if (!appt) return Response.json({ error: 'Appointment not found' }, { status: 404 });

  // Get care profile and verify ownership
  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(eq(careProfiles.id, appt.careProfileId))
    .limit(1);

  if (!profile) return Response.json({ error: 'Care profile not found' }, { status: 404 });

  if (profile.userId !== dbUser!.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Gather all data
  const [meds, labs, recentMemories] = await Promise.all([
    db.select().from(medications).where(eq(medications.careProfileId, profile.id)),
    db.select().from(labResults)
      .where(eq(labResults.userId, dbUser!.id))
      .orderBy(desc(labResults.dateTaken))
      .limit(15),
    db.select({ fact: memories.fact, category: memories.category })
      .from(memories)
      .where(eq(memories.userId, dbUser!.id))
      .orderBy(desc(memories.lastReferenced))
      .limit(20),
  ]);

  const relevantMemories = recentMemories.map((m) => m.fact).join('\n- ');

  // Detect visit type and get targeted template
  const visitType = detectVisitType(appt.purpose, appt.specialty);
  const template = getVisitTemplate(visitType);

  const templateContext = `
VISIT TYPE: ${template.label}

SUGGESTED QUESTIONS FOR THIS TYPE OF VISIT:
${template.questions.map((q) => `- ${q}`).join('\n')}

SUGGESTED THINGS TO BRING:
${template.things_to_bring.map((t) => `- ${t}`).join('\n')}

PREP TASKS:
${template.prep_tasks.map((t) => `- ${t}`).join('\n')}

Use these as a starting point but customize based on the patient's specific data, conditions, and appointment context. Replace generic questions with ones tailored to this patient's situation.`;

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4.6'),
    prompt: `Generate a doctor visit prep sheet. Format it as clean markdown that a caregiver can print or share.

APPOINTMENT:
- Doctor: ${appt.doctorName || 'Unknown'}
- Specialty: ${appt.specialty || 'General'}
- Date: ${appt.dateTime ? new Date(appt.dateTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD'}
- Purpose: ${appt.purpose || 'General visit'}
- Location: ${appt.location || 'Not specified'}

PATIENT:
- Name: ${profile.patientName || 'Unknown'}
- Age: ${profile.patientAge || 'Unknown'}
- Conditions: ${profile.conditions || 'None listed'}
- Allergies: ${profile.allergies || 'None listed'}

CURRENT MEDICATIONS:
${meds.map((m) => `- ${m.name} ${m.dose || ''} ${m.frequency || ''} (prescribed by ${m.prescribingDoctor || 'unknown'})`).join('\n') || '- None listed'}

RECENT LAB RESULTS:
${labs.map((l) => `- ${l.testName}: ${l.value} ${l.unit || ''} (range: ${l.referenceRange || 'N/A'})${l.isAbnormal ? ' ⚠️ ABNORMAL' : ''} [${l.dateTaken || 'no date'}]`).join('\n') || '- No recent labs'}

RELEVANT NOTES FROM PAST CONVERSATIONS:
- ${relevantMemories || 'None'}
${templateContext}

Generate the prep sheet with these sections:
1. **Patient Summary** — one paragraph with key info the doctor needs
2. **Current Medications** — clean table format
3. **Recent Lab Results** — highlight any abnormals with plain English explanations
4. **Questions to Ask** — generate 5 smart, specific questions based on the patient's data, conditions, and the appointment purpose
5. **Things to Bring** — checklist of items (insurance card, medication list, etc.)
6. **Notes** — blank section for writing during the visit

Keep it warm but professional. This is for a family caregiver, not a clinician.`,
  });

  return Response.json({ success: true, prep_sheet: text });
}

export const POST = withMetrics('/api/visit-prep', handler);
