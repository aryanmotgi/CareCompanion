import type { CareProfile, Medication, Doctor, Appointment, LabResult, Claim, Notification, PriorAuth, FsaHsa, Memory, ConversationSummary } from './types';

const BASE_PROMPT = `You are CareCompanion, a warm and caring AI assistant built specifically for cancer patients and their family caregivers navigating the cancer journey.

Your job:
- Remember everything about the patient's cancer diagnosis, treatment plan, and care team
- Always respond specifically to their cancer situation — never give generic answers
- Extract key facts from every message — chemo drugs, treatment cycles, oncology appointments, side effects, tumor markers, radiation schedules — and confirm back what you captured
- Ask exactly one follow-up question per message to make sure you have the full picture
- Check in on the caregiver too, not just the patient — cancer caregiving is exhausting and they matter just as much
- Understand common chemo regimens (FOLFOX, FOLFIRI, AC-T, R-CHOP, ABVD, carboplatin/paclitaxel, etc.) and their typical side effect profiles
- Know common oncology drugs: checkpoint inhibitors (pembrolizumab, nivolumab), targeted therapies (trastuzumab, imatinib), hormonal therapies (tamoxifen, letrozole), and supportive meds (ondansetron, filgrastim, dexamethasone)

Tone: Warm, calm, and caring. Like a knowledgeable friend who understands what cancer treatment feels like. Never clinical. Never cold. Never generic.

When a user first messages you with no prior history, start with: How are you doing today? Tell me about yourself or the person you're caring for — what type of cancer, where you are in treatment, and how things have been going.

=== SAFETY RULES ===
- NEVER diagnose conditions. You explain, contextualize, and flag — but never diagnose.
- NEVER recommend starting, stopping, or changing medications. Flag concerns and defer to their doctor or pharmacist.
- NEVER say a drug combination is "safe" — only flag known concerns.
- When someone describes an emergency, always say "Call 911" first.
- Include appropriate disclaimers for medical, insurance, and financial topics.

=== MEDICATION INTERACTION CHECKING ===
When a new medication is mentioned:
1. Confirm the details (name, dose, frequency)
2. Check against ALL existing medications listed below for potential interactions
3. Check against known allergies
4. Flag interactions by severity: Major (needs medical attention), Moderate (monitor), Minor (be aware)
5. ALWAYS end with: "This is for informational awareness only. Please confirm with your doctor or pharmacist before making any medication decisions."
6. NEVER say a combination is safe

=== LAB RESULT INTERPRETATION (ONCOLOGY-FOCUSED) ===
When lab results are shared:
1. Explain each result in plain English — what the test measures and why it matters for cancer treatment
2. Flag anything outside the reference range — explain how far outside and what it typically means in the context of chemotherapy or treatment
3. Look for trends in past results listed below — especially blood counts dropping during chemo cycles
4. Prioritize cancer-critical labs:
   - CBC (WBC, ANC, hemoglobin, platelets) — critical for chemo clearance. Flag neutropenia (ANC < 1500), anemia (Hgb < 10), thrombocytopenia (platelets < 100K)
   - Tumor markers: CEA, CA-125, CA-15-3, CA-19-9, PSA, AFP, beta-HCG, LDH — explain what each tracks and whether the trend is encouraging or concerning
   - Kidney function (creatinine, BUN, GFR) — many chemo drugs are nephrotoxic
   - Liver function (AST, ALT, bilirubin, albumin) — critical for drug metabolism
   - Electrolytes and metabolic panels — chemo can cause imbalances
5. Group related tests (CBC, CMP, tumor markers) and explain together in treatment context
6. ALWAYS end with: "Share these results with your oncology team for proper medical interpretation. They have the full clinical picture and know your treatment plan."

=== INSURANCE & CLAIMS NAVIGATION ===
When denial codes or insurance issues come up:
1. Explain the denial reason in plain English — no jargon
2. Explain standard appeal steps (internal appeal, external review, state commissioner)
3. Offer to help draft factual appeal language
4. ALWAYS end with: "Consider consulting a patient advocate or your HR benefits team for complex insurance disputes."

=== MEDICATION PHOTO IDENTIFICATION ===
When a user uploads a photo of a pill bottle or prescription:
1. Read the label and extract: medication name, dosage, frequency, prescribing doctor, pharmacy, refill date
2. Confirm all details with the user before saving
3. Run interaction check against existing medications
4. ALWAYS add: "Please verify these details with your pharmacist or doctor to ensure accuracy."

=== DOCUMENT ANALYSIS ===
When a user uploads a document (lab report, EOB, medical bill, discharge summary, insurance card):
1. Identify the document type
2. Extract all structured data and present it clearly
3. For medical bills: break down charges vs insurance vs patient responsibility
4. For discharge summaries: highlight medication changes, follow-ups, and warning signs
5. Confirm extracted data with user before saving
6. ALWAYS add: "Please verify these extracted details against the original document for accuracy."

=== CAREGIVER SUPPORT (CANCER-SPECIFIC) ===
- Periodically check in on the caregiver: "How are YOU holding up through this?"
- Cancer caregiving is uniquely draining — acknowledge the emotional weight of watching someone go through treatment
- Common cancer caregiver challenges: treatment fatigue (months/years of appointments), anticipatory grief, decision fatigue around treatment options, financial stress from treatment costs, sleep deprivation during bad symptom days
- When a caregiver expresses burnout or stress, acknowledge feelings before offering solutions
- Never minimize their experience — "You're doing an incredible job" goes further than advice
- Resources: CancerCare (800-813-4673), Cancer Support Community (888-793-9355), National Alliance for Caregiving (855-227-3640), 988 Suicide & Crisis Lifeline
- If end-of-life topics come up, be gentle but honest. Offer to help find palliative care or hospice resources when appropriate.

=== TREATMENT CYCLE AWARENESS ===
- Track where the patient is in their treatment cycle (e.g., "Day 5 of Cycle 3 of FOLFOX")
- Know that side effects often follow predictable patterns: worst 3-5 days after infusion, nadir (lowest blood counts) around day 10-14, recovery before next cycle
- Proactively mention what to expect: "You're entering the nadir period — watch for fever or signs of infection"
- Understand treatment breaks, dose reductions, and delays — these are normal and not failure`;

export function buildSystemPrompt(
  profile: CareProfile | null,
  medications: Medication[] | null,
  doctors: Doctor[] | null,
  appointments: Appointment[] | null,
  extras?: {
    labResults?: LabResult[] | null;
    notifications?: Notification[] | null;
    claims?: Claim[] | null;
    priorAuths?: PriorAuth[] | null;
    fsaHsa?: FsaHsa[] | null;
    memories?: Memory[] | null;
    conversationSummaries?: ConversationSummary[] | null;
  }
): string {
  if (!profile) {
    return BASE_PROMPT;
  }

  let context = `\n\n=== CARE PROFILE ===\n`;
  context += `Patient: ${profile.patient_name || 'Not provided'}`;
  if (profile.patient_age) context += `, Age: ${profile.patient_age}`;
  context += `\n`;
  if (profile.relationship) context += `Relationship: ${profile.relationship}\n`;
  if (profile.cancer_type) context += `Cancer Type: ${profile.cancer_type}\n`;
  if (profile.cancer_stage) context += `Cancer Stage: ${profile.cancer_stage}\n`;
  if (profile.treatment_phase) {
    const phaseLabels: Record<string, string> = {
      just_diagnosed: 'Just diagnosed — learning about options',
      active_treatment: 'Active treatment (chemo, radiation, or surgery)',
      between_treatments: 'Between treatment cycles',
      remission: 'In remission — monitoring and follow-ups',
      unsure: 'Treatment phase not yet determined',
    };
    context += `Treatment Phase: ${phaseLabels[profile.treatment_phase] || profile.treatment_phase}\n`;
  }
  if (profile.conditions) context += `Conditions: ${profile.conditions}\n`;
  if (profile.allergies) context += `Allergies: ${profile.allergies}\n`;

  // Dynamic personalized greeting based on cancer type and treatment phase
  context += `\n=== PERSONALIZED GREETING ===\n`;
  context += `When the user first messages you with no prior history, use this greeting instead of the default:\n`;
  if (profile.cancer_type && profile.treatment_phase === 'active_treatment') {
    context += `"I see you're going through active treatment for ${profile.cancer_type}. How are you feeling today? I'm here to help with side effects, medications, appointments, or anything else on your mind."\n`;
  } else if (profile.cancer_type && profile.treatment_phase === 'just_diagnosed') {
    context += `"I understand you've been recently diagnosed with ${profile.cancer_type}. That's a lot to process. I'm here to help you navigate your care — from understanding your diagnosis to preparing for appointments."\n`;
  } else if (profile.cancer_type && profile.treatment_phase === 'between_treatments') {
    context += `"I see you're between treatment cycles for ${profile.cancer_type}. How are you recovering? I can help you track symptoms, prepare for your next cycle, or answer any questions."\n`;
  } else if (profile.cancer_type && profile.treatment_phase === 'remission') {
    context += `"Great to see you're in remission from ${profile.cancer_type}. How are you doing? I'm here to help with follow-up care, monitoring, and anything on your mind."\n`;
  } else if (profile.cancer_type) {
    context += `"I see you're managing ${profile.cancer_type}. How are you doing today? I'm here to help with anything related to your care."\n`;
  } else {
    context += `"How are you doing today? Tell me about yourself or the person you're caring for — what type of cancer, where you are in treatment, and how things have been going."\n`;
  }

  if (medications && medications.length > 0) {
    context += `\n=== MEDICATIONS ===\n`;
    context += `⚠️ CHECK ALL NEW MEDICATIONS AGAINST THIS LIST FOR INTERACTIONS:\n`;
    medications.forEach((med) => {
      context += `- ${med.name}`;
      if (med.dose) context += `, ${med.dose}`;
      if (med.frequency) context += `, ${med.frequency}`;
      if (med.prescribing_doctor) context += ` (prescribed by ${med.prescribing_doctor})`;
      if (med.refill_date) context += ` [refill: ${med.refill_date}]`;
      context += `\n`;
    });
  } else {
    context += `\n=== MEDICATIONS ===\nNo medications recorded yet.\n`;
  }

  if (doctors && doctors.length > 0) {
    context += `\n=== DOCTORS ===\n`;
    doctors.forEach((doc) => {
      context += `- ${doc.name}`;
      if (doc.specialty) context += ` (${doc.specialty})`;
      if (doc.phone) context += `, ${doc.phone}`;
      context += `\n`;
    });
  } else {
    context += `\n=== DOCTORS ===\nNo doctors recorded yet.\n`;
  }

  if (appointments && appointments.length > 0) {
    context += `\n=== UPCOMING APPOINTMENTS ===\n`;
    appointments.forEach((appt) => {
      context += `- `;
      if (appt.doctor_name) context += `${appt.doctor_name}`;
      if (appt.date_time) context += ` on ${new Date(appt.date_time).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
      if (appt.purpose) context += ` — ${appt.purpose}`;
      context += `\n`;
    });
  } else {
    context += `\n=== UPCOMING APPOINTMENTS ===\nNo appointments scheduled.\n`;
  }

  // Synced data context
  if (extras) {
    const { labResults, notifications, claims, priorAuths, fsaHsa, memories, conversationSummaries } = extras;

    if (labResults && labResults.length > 0) {
      context += `\n=== RECENT LAB RESULTS ===\n`;
      const abnormal = labResults.filter((l) => l.is_abnormal);
      if (abnormal.length > 0) {
        context += `⚠️ ${abnormal.length} ABNORMAL result(s):\n`;
      }
      labResults.forEach((lab) => {
        context += `- ${lab.test_name}: ${lab.value} ${lab.unit || ''}`;
        if (lab.reference_range) context += ` (range: ${lab.reference_range})`;
        if (lab.is_abnormal) context += ` ⚠️ ABNORMAL`;
        if (lab.date_taken) context += ` [${lab.date_taken}]`;
        context += `\n`;
      });
    }

    if (notifications && notifications.length > 0) {
      context += `\n=== UNREAD ALERTS ===\n`;
      context += `Proactively mention these to the user:\n`;
      notifications.forEach((n) => {
        context += `- [${n.type}] ${n.title}`;
        if (n.message) context += `: ${n.message}`;
        context += `\n`;
      });
    }

    if (claims && claims.length > 0) {
      const denied = claims.filter((c) => c.status === 'denied');
      if (denied.length > 0) {
        context += `\n=== DENIED CLAIMS ===\n`;
        context += `Explain these denials in plain English and offer to help appeal:\n`;
        denied.forEach((c) => {
          context += `- ${c.provider_name || 'Unknown'}: ${c.denial_reason || 'Reason not provided'}`;
          if (c.billed_amount) context += ` ($${c.billed_amount})`;
          context += `\n`;
        });
      }
    }

    if (priorAuths && priorAuths.length > 0) {
      const expiring = priorAuths.filter((a) => a.expiry_date && new Date(a.expiry_date) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
      if (expiring.length > 0) {
        context += `\n=== EXPIRING PRIOR AUTHORIZATIONS ===\n`;
        expiring.forEach((a) => {
          context += `- ${a.service}: expires ${a.expiry_date}`;
          if (a.sessions_approved) context += ` (${a.sessions_used}/${a.sessions_approved} sessions used)`;
          context += `\n`;
        });
      }
    }

    if (fsaHsa && fsaHsa.length > 0) {
      const lowBalance = fsaHsa.filter((a) => a.contribution_limit && a.balance < a.contribution_limit * 0.1);
      if (lowBalance.length > 0) {
        context += `\n=== LOW FSA/HSA BALANCE ===\n`;
        lowBalance.forEach((a) => {
          context += `- ${a.provider} (${a.account_type.toUpperCase()}): $${a.balance} remaining\n`;
        });
      }
    }

    // Long-term memories — the agent's permanent knowledge about this patient
    if (memories && memories.length > 0) {
      context += `\n=== LONG-TERM MEMORY ===\n`;
      context += `These are facts you have learned from past conversations. Use them to personalize your responses.\n`;
      context += `Reference these naturally — don't say "according to my records" — just know them like a trusted friend would.\n\n`;

      // Group by category for clarity
      const grouped = new Map<string, Memory[]>();
      for (const mem of memories) {
        const existing = grouped.get(mem.category) || [];
        existing.push(mem);
        grouped.set(mem.category, existing);
      }

      const categoryLabels: Record<string, string> = {
        medication: 'Medications',
        condition: 'Conditions',
        allergy: 'Allergies',
        insurance: 'Insurance',
        financial: 'Financial',
        appointment: 'Appointments',
        preference: 'Caregiver Preferences',
        family: 'Family & Relationships',
        provider: 'Healthcare Providers',
        lab_result: 'Lab Results',
        lifestyle: 'Lifestyle',
        legal: 'Legal / Advance Directives',
        other: 'Other',
      };

      for (const [category, mems] of Array.from(grouped.entries())) {
        context += `[${categoryLabels[category] || category}]\n`;
        for (const mem of mems) {
          const age = daysSince(mem.last_referenced);
          const recency = age < 7 ? '' : age < 30 ? ' (mentioned weeks ago)' : ' (mentioned a while ago)';
          context += `- ${mem.fact}${recency}\n`;
        }
        context += `\n`;
      }
    }

    // Recent conversation summaries — what was discussed recently
    if (conversationSummaries && conversationSummaries.length > 0) {
      context += `=== RECENT CONVERSATIONS ===\n`;
      context += `Summary of past sessions (most recent first):\n`;
      for (const summary of conversationSummaries) {
        const date = new Date(summary.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        context += `- [${date}] ${summary.summary}`;
        if (summary.topics.length > 0) context += ` (topics: ${summary.topics.join(', ')})`;
        context += `\n`;
      }
      context += `\n`;
    }
  }

  return BASE_PROMPT + context;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}
