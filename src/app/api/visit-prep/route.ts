import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 30;

// POST — generate a structured visit prep sheet for an appointment
export async function POST(req: Request) {
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

  // Get care profile
  const { data: profile } = await admin.from('care_profiles')
    .select('*')
    .eq('id', appt.care_profile_id)
    .single();

  if (!profile) return Response.json({ error: 'Care profile not found' }, { status: 404 });

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
