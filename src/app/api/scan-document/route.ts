import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

const CATEGORY_PROMPTS: Record<string, string> = {
  medication: `You are analyzing a medication-related document (pill bottle, prescription label, or pharmacy printout).

Extract ALL medication information you can find:
- medications: [{name, dose, frequency, prescribing_doctor, refill_date}]

Look carefully for:
- Drug name (brand and/or generic)
- Dosage strength (e.g., 500mg, 10mg/5ml)
- Directions/frequency (e.g., "Take 1 tablet twice daily")
- Prescribing doctor name
- Refill date or "no refills remaining"
- Pharmacy name and phone (put in notes)

Return ONLY valid JSON:
{
  "document_type": "PRESCRIPTION",
  "summary": "Brief description of what was found",
  "medications": [],
  "lab_results": [],
  "insurance": null,
  "conditions": [],
  "appointments": [],
  "claims": [],
  "notes": "",
  "date_taken": null
}`,

  lab_report: `You are analyzing a lab report or test results document.

Extract ALL lab result information:
- lab_results: [{test_name, value, unit, reference_range, is_abnormal}]
- date_taken: the date the lab work was done

Look carefully for:
- Each test name and its result value
- Units of measurement
- Reference/normal ranges
- Flag any results outside reference range as is_abnormal: true
- Ordering physician name (put in notes)
- Date of collection

Return ONLY valid JSON:
{
  "document_type": "LAB_REPORT",
  "summary": "Brief description of what was found",
  "medications": [],
  "lab_results": [],
  "insurance": null,
  "conditions": [],
  "appointments": [],
  "claims": [],
  "notes": "",
  "date_taken": null
}`,

  insurance: `You are analyzing an insurance card or coverage document.

Extract ALL insurance information:
- insurance: {provider, member_id, group_number, plan_type, copay, phone}

Look carefully for:
- Insurance company/provider name
- Member ID / Subscriber ID
- Group number
- Plan type (HMO, PPO, etc.)
- Copay amounts (put in notes if multiple types)
- Customer service phone number
- Rx Bin, PCN, Rx Group (put in notes)
- Network name

Return ONLY valid JSON:
{
  "document_type": "INSURANCE_CARD",
  "summary": "Brief description of what was found",
  "medications": [],
  "lab_results": [],
  "insurance": null,
  "conditions": [],
  "appointments": [],
  "claims": [],
  "notes": "",
  "date_taken": null
}`,

  eob: `You are analyzing an Explanation of Benefits (EOB) or medical billing statement.

Extract ALL claims/billing information:
- claims: [{service_date, provider_name, billed_amount, paid_amount, patient_responsibility, status}]

Look carefully for:
- Date of service
- Provider/facility name
- Amount billed
- Amount insurance paid
- Patient responsibility (what the patient owes)
- Claim status (paid, denied, pending)
- Denial reason if applicable (put in notes)
- Total amounts (put in notes)

Return ONLY valid JSON:
{
  "document_type": "EOB",
  "summary": "Brief description of what was found",
  "medications": [],
  "lab_results": [],
  "insurance": null,
  "conditions": [],
  "appointments": [],
  "claims": [],
  "notes": "",
  "date_taken": null
}`,

  doctor_note: `You are analyzing a doctor's note, visit summary, referral letter, or discharge paper.

Extract ALL medical information:
- conditions: [list of diagnoses/conditions mentioned]
- medications: [{name, dose, frequency}] if any prescribed or changed
- appointments: [{doctor_name, date_time, purpose}] if follow-ups mentioned
- notes: summary of key findings, instructions, and recommendations

Look carefully for:
- Doctor name and specialty
- Visit date
- Diagnoses and conditions
- New or changed medications
- Follow-up appointments scheduled
- Patient instructions
- Referrals to other doctors

Return ONLY valid JSON:
{
  "document_type": "DOCTOR_NOTE",
  "summary": "Brief description of what was found",
  "medications": [],
  "lab_results": [],
  "insurance": null,
  "conditions": [],
  "appointments": [],
  "claims": [],
  "notes": "",
  "date_taken": null
}`,
};

const GENERIC_PROMPT = `You are a medical document analyzer. Analyze this image and extract ALL medical information you can find.

First, identify the document type. Then extract the relevant data.

Document types: PILL_BOTTLE, PRESCRIPTION, LAB_REPORT, INSURANCE_CARD, DOCTOR_NOTE, VISIT_SUMMARY, EOB, OTHER

Return ONLY valid JSON:
{
  "document_type": "...",
  "summary": "Brief one-line description",
  "medications": [],
  "lab_results": [],
  "insurance": null,
  "conditions": [],
  "appointments": [],
  "claims": [],
  "notes": "",
  "date_taken": null
}

Only include fields that have data. For empty arrays use []. For no insurance data use null.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const category = formData.get('category') as string | null;

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');

  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
  if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
    mediaType = 'image/jpeg';
  } else if (file.type === 'image/webp') {
    mediaType = 'image/webp';
  } else if (file.type === 'image/gif') {
    mediaType = 'image/gif';
  }

  const prompt = category && CATEGORY_PROMPTS[category] ? CATEGORY_PROMPTS[category] : GENERIC_PROMPT;

  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  try {
    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ document_type: 'OTHER', summary: 'Could not parse document', medications: [], lab_results: [], insurance: null, conditions: [], appointments: [], claims: [], notes: '' });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return Response.json(parsed);
  } catch {
    return Response.json({ document_type: 'OTHER', summary: 'Failed to analyze document', medications: [], lab_results: [], insurance: null, conditions: [], appointments: [], claims: [], notes: '' });
  }
}
