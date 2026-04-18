import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { careProfiles, medications, doctors, appointments, labResults, insurance, claims, priorAuths, memories, symptomEntries, healthSummaries } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { rateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { ApiErrors } from '@/lib/api-response';
import { withMetrics } from '@/lib/api-metrics';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 });

export const maxDuration = 30;

async function postHandler(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) {
    return ApiErrors.rateLimited();
  }

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  await logAudit({
    user_id: dbUser!.id,
    action: 'generate_summary',
    ip_address: req.headers.get('x-forwarded-for') || undefined,
  });

  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser!.id))
    .limit(1);

  if (!profile) return Response.json({ error: 'No care profile found' }, { status: 400 });

  const [meds, docs, appts, labs, [ins],, priorAuthsData, memoriesData, symptoms] = await Promise.all([
    db.select().from(medications).where(eq(medications.careProfileId, profile.id)),
    db.select().from(doctors).where(eq(doctors.careProfileId, profile.id)),
    db.select().from(appointments).where(eq(appointments.careProfileId, profile.id)).orderBy(desc(appointments.dateTime)).limit(10),
    db.select().from(labResults).where(eq(labResults.userId, dbUser!.id)).orderBy(desc(labResults.dateTaken)).limit(25),
    db.select().from(insurance).where(eq(insurance.userId, dbUser!.id)).limit(1),
    db.select().from(claims).where(eq(claims.userId, dbUser!.id)).orderBy(desc(claims.createdAt)).limit(10),
    db.select().from(priorAuths).where(eq(priorAuths.userId, dbUser!.id)),
    db.select({ fact: memories.fact, category: memories.category }).from(memories).where(eq(memories.userId, dbUser!.id)).orderBy(desc(memories.lastReferenced)).limit(30),
    db.select().from(symptomEntries).where(eq(symptomEntries.userId, dbUser!.id)).orderBy(desc(symptomEntries.date)).limit(14),
  ]);

  const abnormalLabs = labs.filter((l) => l.isAbnormal);

  const { text } = await generateText({
    model: anthropic('claude-haiku-4.5'),
    prompt: `Generate a comprehensive patient health summary document. This is designed to be printed or shared with a new doctor, specialist, or hospital. Format as clean markdown.

PATIENT INFORMATION:
- Name: ${profile.patientName || 'Unknown'}
- Age: ${profile.patientAge || 'Unknown'}
- Relationship to caregiver: ${profile.relationship || 'Not specified'}
- Known Conditions: ${profile.conditions || 'None listed'}
- Known Allergies: ${profile.allergies || 'None listed'}
- Emergency Contact: ${profile.emergencyContactName || 'Not set'} ${profile.emergencyContactPhone || ''}

CURRENT MEDICATIONS (${meds.length}):
${meds.map((m) => `- ${m.name} ${m.dose || ''} ${m.frequency || ''} | Prescribed by: ${m.prescribingDoctor || 'unknown'} | Refill: ${m.refillDate || 'N/A'}`).join('\n') || '- None'}

CARE TEAM (${docs.length} providers):
${docs.map((d) => `- ${d.name} (${d.specialty || 'General'}) | Phone: ${d.phone || 'N/A'}`).join('\n') || '- None'}

RECENT APPOINTMENTS:
${appts.map((a) => `- ${a.doctorName || 'Unknown'} on ${a.dateTime ? new Date(a.dateTime).toLocaleDateString() : 'N/A'} — ${a.purpose || ''}`).join('\n') || '- None'}

LAB RESULTS (${labs.length} total, ${abnormalLabs.length} abnormal):
${labs.map((l) => `- ${l.testName}: ${l.value} ${l.unit || ''} (range: ${l.referenceRange || 'N/A'})${l.isAbnormal ? ' ⚠️ ABNORMAL' : ''} [${l.dateTaken || 'no date'}]`).join('\n') || '- None'}

INSURANCE:
${ins ? `- Provider: ${ins.provider} | Member ID: ${ins.memberId || 'N/A'} | Group: ${ins.groupNumber || 'N/A'}
- Deductible: $${ins.deductibleUsed || 0} / $${ins.deductibleLimit || 'N/A'} | OOP: $${ins.oopUsed || 0} / $${ins.oopLimit || 'N/A'}` : '- Not on file'}

PRIOR AUTHORIZATIONS:
${priorAuthsData.map((a) => `- ${a.service}: ${a.status || 'active'} | Expires: ${a.expiryDate || 'N/A'} | Sessions: ${a.sessionsUsed}/${a.sessionsApproved || '?'}`).join('\n') || '- None'}

RECENT SYMPTOM JOURNAL (last 14 days):
${symptoms.map((s) => `- ${s.date}: Pain ${s.painLevel ?? 'N/A'}/10 | Mood: ${s.mood || 'N/A'} | Sleep: ${s.sleepQuality || 'N/A'} (${s.sleepHours || '?'}h) | Symptoms: ${s.symptoms?.join(', ') || 'none'}`).join('\n') || '- No entries'}

KEY NOTES FROM CARE HISTORY:
${memoriesData.map((m) => `- [${m.category}] ${m.fact}`).join('\n') || '- None'}

Generate the summary with these sections:
1. **Patient Overview** — demographics, conditions, allergies (highlighted)
2. **Current Medications** — clean table with name, dose, frequency, prescriber
3. **Care Team** — all providers with contact info
4. **Recent Lab Results** — table format, flag abnormals with brief explanations
5. **Health Trends** — if symptom data exists, summarize patterns (pain, sleep, mood)
6. **Active Prior Authorizations** — any current PAs
7. **Insurance Information** — plan details and spending
8. **Recent Visit Notes** — key takeaways from recent appointments
9. **Important Notes** — anything from memories the doctor should know
10. **Generated** — date and "Generated by CareCompanion" footer

Make it professional but readable. A doctor should be able to scan it in 2 minutes and have a complete picture.`,
  });

  // Cache the generated summary
  await db.insert(healthSummaries).values({
    userId: dbUser!.id,
    careProfileId: profile.id,
    summary: { content: text },
    generatedAt: new Date(),
  });

  return Response.json({ success: true, summary: text, generated_at: new Date().toISOString() });
}

export const POST = withMetrics('/api/health-summary', postHandler);

async function getHandler(/* req: Request */) {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const [data] = await db
    .select({ summary: healthSummaries.summary, generatedAt: healthSummaries.generatedAt })
    .from(healthSummaries)
    .where(eq(healthSummaries.userId, dbUser!.id))
    .orderBy(desc(healthSummaries.generatedAt))
    .limit(1);

  if (!data) {
    return Response.json({ summary: null, message: 'No health summary generated yet. Use POST to generate one.' });
  }

  const summaryContent = (data.summary as Record<string, unknown>)?.content || data.summary;
  return Response.json({ summary: summaryContent, generated_at: data.generatedAt });
}

export const GET = withMetrics('/api/health-summary', getHandler);
