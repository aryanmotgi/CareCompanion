import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectVisitType, getVisitTemplate } from '@/lib/visit-prep-templates';
import { rateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { withMetrics } from '@/lib/api-metrics';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 });

export const maxDuration = 30;

// POST — generate a structured visit prep sheet for an appointment
async function handler(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { appointment_id } = await req.json();
  const admin = createAdminClient();

  // Get the appointment
  const { data: appt } = await admin.from('appointments')
    .select('*')
    .eq('id', appointment_id)
    .single();

  if (!appt) return Response.json({ error: 'Appointment not found' }, { status: 404 });

  // Get care profile and verify ownership
  const { data: profile } = await admin.from('care_profiles')
    .select('*')
    .eq('id', appt.care_profile_id)
    .single();

  if (!profile) return Response.json({ error: 'Care profile not found' }, { status: 404 });

  if (profile.user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Gather all data
  const [
    { data: meds },
    { data: labs },
    ,
    { data: memories },
  ] = await Promise.all([
    admin.from('medications').select('*').eq('care_profile_id', profile.id),
    admin.from('lab_results').select('*').eq('user_id', user.id).order('date_taken', { ascending: false }).limit(15),
    admin.from('doctors').select('*').eq('care_profile_id', profile.id),
    admin.from('memories').select('fact, category').eq('user_id', user.id).order('last_referenced', { ascending: false }).limit(20),
  ]);

  const relevantMemories = (memories || []).map((m) => m.fact).join('\n- ');

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
    model: anthropic('claude-sonnet-4-6'),
    prompt: `Generate a doctor visit prep sheet. Format it as clean markdown that a caregiver can print or share.

APPOINTMENT:
- Doctor: ${appt.doctor_name || 'Unknown'}
- Specialty: ${appt.specialty || 'General'}
- Date: ${appt.date_time ? new Date(appt.date_time).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD'}
- Purpose: ${appt.purpose || 'General visit'}
- Location: ${appt.location || 'Not specified'}

PATIENT:
- Name: ${profile.patient_name || 'Unknown'}
- Age: ${profile.patient_age || 'Unknown'}
- Conditions: ${profile.conditions || 'None listed'}
- Allergies: ${profile.allergies || 'None listed'}

CURRENT MEDICATIONS:
${(meds || []).map((m) => `- ${m.name} ${m.dose || ''} ${m.frequency || ''} (prescribed by ${m.prescribing_doctor || 'unknown'})`).join('\n') || '- None listed'}

RECENT LAB RESULTS:
${(labs || []).map((l) => `- ${l.test_name}: ${l.value} ${l.unit || ''} (range: ${l.reference_range || 'N/A'})${l.is_abnormal ? ' ⚠️ ABNORMAL' : ''} [${l.date_taken || 'no date'}]`).join('\n') || '- No recent labs'}

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

  // Save prep notes to the appointment
  await admin.from('appointments')
    .update({ prep_notes: text })
    .eq('id', appointment_id);

  return Response.json({ success: true, prep_sheet: text });
}

export const POST = withMetrics('/api/visit-prep', handler);
