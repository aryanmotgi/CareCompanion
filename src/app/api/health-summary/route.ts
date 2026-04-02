import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 30;

// POST — generate a comprehensive health summary document
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin.from('care_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile) return Response.json({ error: 'No care profile found' }, { status: 400 });

  // Gather everything
  const [
    { data: meds },
    { data: doctors },
    { data: appointments },
    { data: labs },
    { data: insurance },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { data: claims },
    { data: priorAuths },
    { data: memories },
    { data: symptoms },
  ] = await Promise.all([
    admin.from('medications').select('*').eq('care_profile_id', profile.id),
    admin.from('doctors').select('*').eq('care_profile_id', profile.id),
    admin.from('appointments').select('*').eq('care_profile_id', profile.id).order('date_time', { ascending: false }).limit(10),
    admin.from('lab_results').select('*').eq('user_id', user.id).order('date_taken', { ascending: false }).limit(25),
    admin.from('insurance').select('*').eq('user_id', user.id).limit(1).single(),
    admin.from('claims').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    admin.from('prior_auths').select('*').eq('user_id', user.id),
    admin.from('memories').select('fact, category').eq('user_id', user.id).order('last_referenced', { ascending: false }).limit(30),
    admin.from('symptom_entries').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(14),
  ]);

  const abnormalLabs = (labs || []).filter((l) => l.is_abnormal);

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    prompt: `Generate a comprehensive patient health summary document. This is designed to be printed or shared with a new doctor, specialist, or hospital. Format as clean markdown.

PATIENT INFORMATION:
- Name: ${profile.patient_name || 'Unknown'}
- Age: ${profile.patient_age || 'Unknown'}
- Relationship to caregiver: ${profile.relationship || 'Not specified'}
- Known Conditions: ${profile.conditions || 'None listed'}
- Known Allergies: ${profile.allergies || 'None listed'}
- Emergency Contact: ${profile.emergency_contact_name || 'Not set'} ${profile.emergency_contact_phone || ''}

CURRENT MEDICATIONS (${(meds || []).length}):
${(meds || []).map((m) => `- ${m.name} ${m.dose || ''} ${m.frequency || ''} | Prescribed by: ${m.prescribing_doctor || 'unknown'} | Refill: ${m.refill_date || 'N/A'}`).join('\n') || '- None'}

CARE TEAM (${(doctors || []).length} providers):
${(doctors || []).map((d) => `- ${d.name} (${d.specialty || 'General'}) | Phone: ${d.phone || 'N/A'}`).join('\n') || '- None'}

RECENT APPOINTMENTS:
${(appointments || []).map((a) => `- ${a.doctor_name || 'Unknown'} on ${a.date_time ? new Date(a.date_time).toLocaleDateString() : 'N/A'} — ${a.purpose || ''}${a.follow_up_notes ? ` | Notes: ${a.follow_up_notes}` : ''}`).join('\n') || '- None'}

LAB RESULTS (${(labs || []).length} total, ${abnormalLabs.length} abnormal):
${(labs || []).map((l) => `- ${l.test_name}: ${l.value} ${l.unit || ''} (range: ${l.reference_range || 'N/A'})${l.is_abnormal ? ' ⚠️ ABNORMAL' : ''} [${l.date_taken || 'no date'}]`).join('\n') || '- None'}

INSURANCE:
${insurance ? `- Provider: ${insurance.provider} | Member ID: ${insurance.member_id || 'N/A'} | Group: ${insurance.group_number || 'N/A'}
- Deductible: $${insurance.deductible_used || 0} / $${insurance.deductible_limit || 'N/A'} | OOP: $${insurance.oop_used || 0} / $${insurance.oop_limit || 'N/A'}` : '- Not on file'}

PRIOR AUTHORIZATIONS:
${(priorAuths || []).map((a) => `- ${a.service}: ${a.status || 'active'} | Expires: ${a.expiry_date || 'N/A'} | Sessions: ${a.sessions_used}/${a.sessions_approved || '?'}`).join('\n') || '- None'}

RECENT SYMPTOM JOURNAL (last 14 days):
${(symptoms || []).map((s) => `- ${s.date}: Pain ${s.pain_level ?? 'N/A'}/10 | Mood: ${s.mood || 'N/A'} | Sleep: ${s.sleep_quality || 'N/A'} (${s.sleep_hours || '?'}h) | Symptoms: ${s.symptoms?.join(', ') || 'none'}`).join('\n') || '- No entries'}

KEY NOTES FROM CARE HISTORY:
${(memories || []).map((m) => `- [${m.category}] ${m.fact}`).join('\n') || '- None'}

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

  return Response.json({ success: true, summary: text });
}
