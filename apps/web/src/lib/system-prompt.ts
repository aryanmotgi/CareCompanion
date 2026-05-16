import type { CareProfile, Medication, Doctor, Appointment, LabResult, Claim, Notification, PriorAuth, FsaHsa, Memory, ConversationSummary, SymptomEntry, TreatmentCycle } from './types';

export type SystemBlocks = {
  /** L1: BASE_PROMPT constant — identical across all users + sessions */
  base: string;
  /** L2: stable per-user — no dates, no daysSince, no Date.now */
  userStable: string;
  /** L3: per-turn dynamic — treatment cycle day, recent labs, today's appts */
  userDynamic: string;
  /** L4: retrieved memories + summaries — changes per query */
  retrieved: string;
};

export type BuildSystemPromptExtras = {
  labResults?: LabResult[] | null;
  notifications?: Notification[] | null;
  claims?: Claim[] | null;
  priorAuths?: PriorAuth[] | null;
  fsaHsa?: FsaHsa[] | null;
  memories?: Memory[] | null;
  conversationSummaries?: ConversationSummary[] | null;
  symptoms?: SymptomEntry[] | null;
  treatmentCycle?: TreatmentCycle | null;
  /** Pre-computed by caller. Concatenated into L2 ahead of profile section. */
  roleContext?: string | null;
};

// Patterns that indicate a user-crafted AI behavioral directive rather than a
// genuine patient/caregiver fact. These must not be injected into the system prompt.
const AI_DIRECTIVE_PATTERNS: RegExp[] = [
  /\b(always|never)\s+(recommend|suggest|tell|say|respond|answer|advise|instruct)\b/i,
  /\b(ignore|forget|disregard|override|bypass)\b/i,
  /\bfrom now on\b/i,
  /\byour\s+(new\s+)?(instruction|directive|rule|guideline|system prompt|behavior|persona)\b/i,
  /\bwhen\s+(i|they|the user)\s+ask\b/i,
  /\bdo not\s+(recommend|suggest|mention|discuss)\b/i,
  /\bstop\s+(recommending|suggesting|telling)\b/i,
  /\bact as\b/i,
  /\bpretend\b/i,
];

/**
 * Returns the fact string if it looks like a genuine patient/caregiver fact,
 * or null if it matches an AI directive injection pattern.
 */
function sanitizeMemoryFact(fact: string): string | null {
  if (AI_DIRECTIVE_PATTERNS.some((p) => p.test(fact))) {
    return null;
  }
  return fact;
}

export function buildRoleContext(opts: {
  role: string | null
  primaryConcern: string | null
  caregivingExperience: string | null
  /** Patient's display name, for caregivers — used to personalize copy. */
  patientName?: string | null
  /** Caregiver's relationship to the patient (migration 012). One of
   *  'spouse' | 'parent' | 'child' | 'sibling' | 'friend' | 'other'. */
  caregiverRelationship?: string | null
}): string {
  const parts: string[] = []

  if (opts.role === 'caregiver') {
    if (opts.patientName) {
      const rel = opts.caregiverRelationship
      // Lead with the relationship — turns "the patient" into a person.
      if (rel === 'spouse')        parts.push(`The user is caring for their spouse/partner, ${opts.patientName}.`)
      else if (rel === 'parent')   parts.push(`The user is caring for their parent, ${opts.patientName}.`)
      else if (rel === 'child')    parts.push(`The user is caring for their child, ${opts.patientName}.`)
      else if (rel === 'sibling')  parts.push(`The user is caring for their sibling, ${opts.patientName}.`)
      else if (rel === 'friend')   parts.push(`The user is caring for their friend, ${opts.patientName}.`)
      else                         parts.push(`The user is caring for ${opts.patientName}.`)
      parts.push(`Refer to the patient as ${opts.patientName} in your responses, not "the patient" or "your loved one".`)
    } else {
      parts.push('The user is a caregiver helping a patient manage their cancer care.')
    }
    if (opts.caregivingExperience === 'first_time') {
      parts.push('This is their first time caregiving — use plain language, offer extra context, be encouraging.')
    } else if (opts.caregivingExperience === 'experienced') {
      parts.push('They are an experienced caregiver — be direct and clinical when appropriate.')
    }
    parts.push('Be concise and task-oriented. Do not proactively check in on the caregiver\'s emotional state — focus on actionable next steps: medication adherence, upcoming appointments, care coordination. Only address caregiver wellbeing if the caregiver raises it.')
  } else if (opts.role === 'patient') {
    parts.push('The user is a patient managing their own cancer care.')
  } else if (opts.role === 'self') {
    parts.push('The user is managing their own health care independently without a dedicated caregiver.')
  }

  const concernMap: Record<string, string> = {
    medications: 'Their primary concern is managing medications — prioritize medication tracking, dose schedules, and drug interaction explanations.',
    lab_results: 'Their primary concern is understanding lab results and appointments — proactively explain test values and flag abnormal results.',
    coordinating_care: 'Their primary concern is coordinating care — surface specialist appointments, referral tracking, and questions to ask doctors.',
    emotional_support: 'Their primary concern is emotional support — open with empathy, offer coping resources, monitor caregiver stress.',
  }

  if (opts.primaryConcern && concernMap[opts.primaryConcern]) {
    parts.push(concernMap[opts.primaryConcern])
  }

  return parts.join(' ')
}

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

/**
 * Build the 4-block system prompt structure for prompt caching.
 *
 * L1 (base): BASE_PROMPT constant. Identical across all users.
 * L2 (userStable): per-user but stable — care profile, role context, onboarding
 *   priorities, personalized greeting. NEVER contains computed dates, day-of-cycle,
 *   "X days ago" strings, or Age (use dateOfBirth → Born: year for cache stability).
 * L3 (userDynamic): per-turn. Treatment cycle day-of-cycle math, recent labs,
 *   upcoming appointments, symptoms, alerts, denied claims, expiring priorAuths.
 * L4 (retrieved): retrieved memories + recent conversation summaries.
 *
 * Mark L1 + L2 with Anthropic cacheControl in the caller for cache hits.
 */
export function buildSystemPromptBlocks(
  profile: CareProfile | null,
  medications: Medication[] | null,
  doctors: Doctor[] | null,
  appointments: Appointment[] | null,
  extras?: BuildSystemPromptExtras,
): SystemBlocks {
  const base = BASE_PROMPT;

  if (!profile) {
    return { base, userStable: '', userDynamic: '', retrieved: '' };
  }

  let userStable = '';
  if (extras?.roleContext) {
    userStable += `${extras.roleContext}\n\n`;
  }

  userStable += `=== CARE PROFILE ===\n`;
  userStable += `Patient: ${profile.patientName || 'Not provided'}`;
  if (profile.dateOfBirth) {
    const year = new Date(profile.dateOfBirth).getUTCFullYear();
    if (Number.isFinite(year)) userStable += `, Born: ${year}`;
  }
  userStable += `\n`;
  if (profile.relationship) userStable += `Relationship: ${profile.relationship}\n`;
  if (profile.cancerType) userStable += `Cancer Type: ${profile.cancerType}\n`;
  if (profile.cancerStage) userStable += `Cancer Stage: ${profile.cancerStage}\n`;
  if (profile.treatmentPhase) {
    const phaseLabels: Record<string, string> = {
      just_diagnosed: 'Just diagnosed — learning about options',
      active_treatment: 'Active treatment (chemo, radiation, or surgery)',
      between_treatments: 'Between treatment cycles',
      remission: 'In remission — monitoring and follow-ups',
      unsure: 'Treatment phase not yet determined',
    };
    userStable += `Treatment Phase: ${phaseLabels[profile.treatmentPhase] || profile.treatmentPhase}\n`;
  }
  if (profile.conditions) userStable += `Conditions: ${profile.conditions}\n`;
  if (profile.allergies) userStable += `Allergies: ${profile.allergies}\n`;

  if (profile.role === 'caregiver' && profile.caregiverForName) {
    userStable += `\n=== CAREGIVER MODE ===\n`;
    userStable += `The user is a caregiver for ${profile.caregiverForName}. Adapt your tone to address caregiver concerns.\n`;
    userStable += `- Address the user as a caregiver, not the patient\n`;
    userStable += `- When discussing symptoms, medications, or treatments, refer to "${profile.caregiverForName}" as the patient\n`;
    userStable += `- Proactively check in on the caregiver's wellbeing — caregiving is exhausting\n`;
    userStable += `- Offer practical tips for managing care responsibilities\n`;
  }

  if (profile.onboardingPriorities && profile.onboardingPriorities.length > 0) {
    const priorityLabels: Record<string, string> = {
      side_effects: 'tracking side effects',
      medications: 'managing medications',
      appointments: 'preparing for appointments',
      lab_results: 'understanding lab results',
      insurance: 'insurance & billing',
      emotional: 'emotional support',
    };
    userStable += `User priorities: ${profile.onboardingPriorities.map(p => priorityLabels[p] || p).join(', ')}\n`;
    userStable += `Focus extra attention on these areas in your responses.\n`;
  }

  userStable += `\n=== PERSONALIZED GREETING ===\n`;
  userStable += `When the user first messages you with no prior history, use this greeting instead of the default:\n`;
  if (profile.cancerType && profile.treatmentPhase === 'active_treatment') {
    userStable += `"I see you're going through active treatment for ${profile.cancerType}. How are you feeling today? I'm here to help with side effects, medications, appointments, or anything else on your mind."\n`;
  } else if (profile.cancerType && profile.treatmentPhase === 'just_diagnosed') {
    userStable += `"I understand you've been recently diagnosed with ${profile.cancerType}. That's a lot to process. I'm here to help you navigate your care — from understanding your diagnosis to preparing for appointments."\n`;
  } else if (profile.cancerType && profile.treatmentPhase === 'between_treatments') {
    userStable += `"I see you're between treatment cycles for ${profile.cancerType}. How are you recovering? I can help you track symptoms, prepare for your next cycle, or answer any questions."\n`;
  } else if (profile.cancerType && profile.treatmentPhase === 'remission') {
    userStable += `"Great to see you're in remission from ${profile.cancerType}. How are you doing? I'm here to help with follow-up care, monitoring, and anything on your mind."\n`;
  } else if (profile.cancerType) {
    userStable += `"I see you're managing ${profile.cancerType}. How are you doing today? I'm here to help with anything related to your care."\n`;
  } else {
    userStable += `"How are you doing today? Tell me about yourself or the person you're caring for — what type of cancer, where you are in treatment, and how things have been going."\n`;
  }

  let userDynamic = '';

  if (extras?.treatmentCycle) {
    const tc = extras.treatmentCycle;
    const startDate = new Date(tc.startDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - startDate.getTime();
    const dayOfCycle = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const daysRemaining = Math.max(0, tc.cycleLengthDays - dayOfCycle);

    userDynamic += `\n=== ACTIVE TREATMENT CYCLE ===\n`;
    userDynamic += `Patient is on Day ${dayOfCycle} of Cycle ${tc.cycleNumber}`;
    if (tc.regimenName) userDynamic += ` (${tc.regimenName})`;
    userDynamic += `. Cycle started ${tc.startDate}, ${tc.cycleLengthDays}-day cycle.\n`;
    userDynamic += `Days remaining in cycle: ${daysRemaining}\n`;
    userDynamic += `\nCycle-aware guidance:\n`;
    userDynamic += `- Days 1-2: Infusion/treatment day and immediate aftermath. Watch for acute reactions.\n`;
    userDynamic += `- Days 3-5: Nausea and fatigue typically peak. Anti-nausea meds are critical.\n`;
    userDynamic += `- Days 7-14: Nadir period — blood counts at their lowest. Watch for fever (>100.4°F), signs of infection, unusual bleeding, or severe fatigue.\n`;
    userDynamic += `- Days 14-21: Recovery phase — counts rebounding, energy returning.\n`;
    userDynamic += `Reference the patient's current cycle day when discussing symptoms, side effects, or what to expect next.\n`;
  }

  const _now = new Date();
  const _sevenDaysAgo = new Date(_now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const relevantAppointments = (appointments ?? []).filter((appt) => {
    if (!appt.dateTime) return false;
    return new Date(appt.dateTime) >= _sevenDaysAgo;
  });
  const _activeDoctorNames = new Set<string>();
  (medications ?? []).forEach((m) => {
    if (m.prescribingDoctor) _activeDoctorNames.add(m.prescribingDoctor.toLowerCase());
  });
  relevantAppointments.forEach((appt) => {
    if (appt.doctorName) _activeDoctorNames.add(appt.doctorName.toLowerCase());
  });
  const _activeDoctors = (doctors ?? []).filter((d) => _activeDoctorNames.has(d.name.toLowerCase()));
  const doctorsToShow = _activeDoctors.length > 0 ? _activeDoctors : (doctors ?? []);

  if (medications && medications.length > 0) {
    userDynamic += `\n=== MEDICATIONS ===\n`;
    userDynamic += `⚠️ CHECK ALL NEW MEDICATIONS AGAINST THIS LIST FOR INTERACTIONS:\n`;
    medications.forEach((med) => {
      userDynamic += `- ${med.name}`;
      if (med.dose) userDynamic += `, ${med.dose}`;
      if (med.frequency) userDynamic += `, ${med.frequency}`;
      if (med.prescribingDoctor) userDynamic += ` (prescribed by ${med.prescribingDoctor})`;
      if (med.refillDate) userDynamic += ` [refill: ${med.refillDate}]`;
      userDynamic += `\n`;
    });
  } else {
    userDynamic += `\n=== MEDICATIONS ===\nNo medications recorded yet.\n`;
  }

  if (doctorsToShow.length > 0) {
    userDynamic += `\n=== DOCTORS ===\n`;
    doctorsToShow.forEach((doc) => {
      userDynamic += `- ${doc.name}`;
      if (doc.specialty) userDynamic += ` (${doc.specialty})`;
      if (doc.phone) userDynamic += `, ${doc.phone}`;
      userDynamic += `\n`;
    });
  }

  if (relevantAppointments.length > 0) {
    userDynamic += `\n=== UPCOMING APPOINTMENTS ===\n`;
    relevantAppointments.forEach((appt) => {
      userDynamic += `- `;
      if (appt.doctorName) userDynamic += `${appt.doctorName}`;
      if (appt.dateTime) userDynamic += ` on ${new Date(appt.dateTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
      if (appt.purpose) userDynamic += ` — ${appt.purpose}`;
      userDynamic += `\n`;
    });
  }

  let retrieved = '';

  if (extras) {
    const { labResults, notifications, claims, priorAuths, fsaHsa, memories, conversationSummaries, symptoms } = extras;

    if (labResults && labResults.length > 0) {
      const abnormalLabs = labResults.filter((l) => l.isAbnormal);
      const normalLabs = labResults.filter((l) => !l.isAbnormal);
      const cappedLabs = [...abnormalLabs, ...normalLabs].slice(0, 10);
      userDynamic += `\n=== RECENT LAB RESULTS ===\n`;
      if (abnormalLabs.length > 0) {
        userDynamic += `⚠️ ${abnormalLabs.length} ABNORMAL result(s):\n`;
      }
      cappedLabs.forEach((lab) => {
        userDynamic += `- ${lab.testName}: ${lab.value} ${lab.unit || ''}`;
        if (lab.referenceRange) userDynamic += ` (range: ${lab.referenceRange})`;
        if (lab.isAbnormal) userDynamic += ` ⚠️ ABNORMAL`;
        if (lab.dateTaken) userDynamic += ` [${lab.dateTaken}]`;
        userDynamic += `\n`;
      });
    }

    if (symptoms && symptoms.length > 0) {
      const cappedSymptoms = symptoms.slice(0, 14);
      userDynamic += `\n=== RECENT SYMPTOMS (last 14 days) ===\n`;
      userDynamic += `Use these to understand how the patient has been feeling. Look for patterns and trends.\n`;
      cappedSymptoms.forEach((s) => {
        const parts: string[] = [];
        if (s.painLevel !== null && s.painLevel !== undefined) parts.push(`pain ${s.painLevel}/10`);
        if (s.mood !== null && s.mood !== undefined) parts.push(`mood ${s.mood}/10`);
        if (s.energy !== null && s.energy !== undefined) parts.push(`energy ${s.energy}/10`);
        if (s.sleepQuality !== null && s.sleepQuality !== undefined) parts.push(`sleep quality ${s.sleepQuality}/10`);
        if (s.sleepHours !== null && s.sleepHours !== undefined) parts.push(`${s.sleepHours}h sleep`);
        if (s.appetite !== null && s.appetite !== undefined) parts.push(`appetite ${s.appetite}/10`);
        if (s.symptoms && s.symptoms.length > 0) parts.push(`symptoms: ${s.symptoms.join(', ')}`);
        userDynamic += `- [${s.date}] ${parts.join(', ')}\n`;
      });
    }

    if (notifications && notifications.length > 0) {
      const cappedNotifications = notifications.slice(0, 5);
      const notifOverflow = notifications.length - cappedNotifications.length;
      userDynamic += `\n=== UNREAD ALERTS ===\n`;
      userDynamic += `Proactively mention these to the user:\n`;
      cappedNotifications.forEach((n) => {
        userDynamic += `- [${n.type}] ${n.title}`;
        if (n.message) userDynamic += `: ${n.message}`;
        userDynamic += `\n`;
      });
      if (notifOverflow > 0) userDynamic += `(+${notifOverflow} more unread)\n`;
    }

    if (claims && claims.length > 0) {
      const denied = claims.filter((c) => c.status === 'denied');
      if (denied.length > 0) {
        userDynamic += `\n=== DENIED CLAIMS ===\n`;
        userDynamic += `Explain these denials in plain English and offer to help appeal:\n`;
        denied.forEach((c) => {
          userDynamic += `- ${c.providerName || 'Unknown'}: ${c.denialReason || 'Reason not provided'}`;
          if (c.billedAmount) userDynamic += ` ($${c.billedAmount})`;
          userDynamic += `\n`;
        });
      }
    }

    if (priorAuths && priorAuths.length > 0) {
      const expiring = priorAuths.filter((a) => a.expiryDate && new Date(a.expiryDate) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
      if (expiring.length > 0) {
        userDynamic += `\n=== EXPIRING PRIOR AUTHORIZATIONS ===\n`;
        expiring.forEach((a) => {
          userDynamic += `- ${a.service}: expires ${a.expiryDate}`;
          if (a.sessionsApproved) userDynamic += ` (${a.sessionsUsed}/${a.sessionsApproved} sessions used)`;
          userDynamic += `\n`;
        });
      }
    }

    if (fsaHsa && fsaHsa.length > 0) {
      const lowBalance = fsaHsa.filter((a) => a.contributionLimit && a.balance && parseFloat(a.balance) < parseFloat(a.contributionLimit) * 0.1);
      if (lowBalance.length > 0) {
        userDynamic += `\n=== LOW FSA/HSA BALANCE ===\n`;
        lowBalance.forEach((a) => {
          userDynamic += `- ${a.provider} (${(a.accountType ?? '').toUpperCase()}): $${a.balance} remaining\n`;
        });
      }
    }

    const safeMemories = (memories ?? []).filter((m) => m.confidence !== 'low');
    if (safeMemories.length > 0) {
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

      const medNames = new Set((medications ?? []).map((m) => m.name.toLowerCase()));
      const labNames = new Set((labResults ?? []).map((l) => l.testName.toLowerCase()));
      const cancerType = (profile.cancerType ?? '').toLowerCase();

      const deduped = safeMemories.filter((m) => {
        const factLower = m.fact.toLowerCase();
        if (m.category === 'medication') {
          return !Array.from(medNames).some((name) => factLower.includes(name));
        }
        if (m.category === 'lab_result') {
          return !Array.from(labNames).some((name) => factLower.includes(name));
        }
        if (m.category === 'condition' && cancerType) {
          return !factLower.includes(cancerType);
        }
        return true;
      });

      const memoryLines: string[] = [];
      for (const mem of deduped) {
        const sanitized = sanitizeMemoryFact(mem.fact);
        if (!sanitized) continue;
        const age = mem.lastReferenced ? daysSince(mem.lastReferenced.toISOString()) : 999;
        const recency = age >= 30 ? ' (mentioned a while ago)' : '';
        const label = categoryLabels[mem.category] || mem.category;
        memoryLines.push(`[${label}] ${sanitized}${recency}`);
      }

      if (memoryLines.length > 0) {
        retrieved += `\n=== LONG-TERM MEMORY ===\n`;
        retrieved += `Facts from past conversations — know these like a trusted friend would:\n`;
        retrieved += memoryLines.join('\n') + '\n';
      }
    }

    if (conversationSummaries && conversationSummaries.length > 0) {
      const recentSummaries = conversationSummaries.slice(0, 3);
      retrieved += `=== RECENT CONVERSATIONS ===\n`;
      retrieved += `Summary of past sessions (most recent first):\n`;
      for (const summary of recentSummaries) {
        const date = summary.createdAt ? new Date(summary.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const text = summary.summary.length > 800 ? summary.summary.slice(0, 800) + '...' : summary.summary;
        retrieved += `- [${date}] ${text}`;
        if (summary.topics && summary.topics.length > 0) retrieved += ` (topics: ${summary.topics.join(', ')})`;
        retrieved += `\n`;
      }
      retrieved += `\n`;
    }
  }

  return {
    base,
    userStable: userStable ? `\n\n${userStable}` : '',
    userDynamic,
    retrieved,
  };
}

/**
 * Backward-compatible shim — concatenates all 4 blocks into one string.
 * Use buildSystemPromptBlocks + Anthropic cacheControl for cache hits.
 */
export function buildSystemPrompt(
  profile: CareProfile | null,
  medications: Medication[] | null,
  doctors: Doctor[] | null,
  appointments: Appointment[] | null,
  extras?: BuildSystemPromptExtras,
): string {
  const b = buildSystemPromptBlocks(profile, medications, doctors, appointments, extras);
  return b.base + b.userStable + b.userDynamic + b.retrieved;
}
function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}
