/**
 * Visit preparation templates by visit type.
 * Generates customized questions and checklists based on
 * whether it's a first visit, follow-up, specialist referral, etc.
 */

type VisitType = 'first_oncology' | 'follow_up' | 'new_specialist' | 'er_visit' | 'infusion' | 'scan_results' | 'second_opinion' | 'general'

interface VisitPrepTemplate {
  type: VisitType
  label: string
  questions: string[]
  things_to_bring: string[]
  prep_tasks: string[]
}

/**
 * Detect visit type from appointment context.
 */
export function detectVisitType(
  purpose?: string | null,
  specialty?: string | null,
  isFirstVisit?: boolean,
  doctorName?: string | null,
  patientHistory?: { hasPriorVisitsWithDoctor: boolean; treatmentPhase?: string | null },
): VisitType {
  const purposeLower = (purpose || '').toLowerCase()
  const specialtyLower = (specialty || '').toLowerCase()

  // First oncology visit
  if (isFirstVisit && (specialtyLower.includes('oncol') || purposeLower.includes('cancer') || purposeLower.includes('diagnosis'))) {
    return 'first_oncology'
  }

  // Scan/imaging results
  if (purposeLower.includes('scan') || purposeLower.includes('ct result') || purposeLower.includes('mri result') || purposeLower.includes('pet result') || purposeLower.includes('imaging')) {
    return 'scan_results'
  }

  // Infusion/chemo
  if (purposeLower.includes('infusion') || purposeLower.includes('chemo') || purposeLower.includes('treatment cycle')) {
    return 'infusion'
  }

  // ER visit
  if (purposeLower.includes('emergency') || purposeLower.includes('er ') || purposeLower.includes('urgent')) {
    return 'er_visit'
  }

  // Second opinion
  if (purposeLower.includes('second opinion') || purposeLower.includes('2nd opinion')) {
    return 'second_opinion'
  }

  // New specialist
  if (isFirstVisit || (doctorName && patientHistory && !patientHistory.hasPriorVisitsWithDoctor)) {
    return 'new_specialist'
  }

  // Follow-up (default for known doctors)
  if (patientHistory?.hasPriorVisitsWithDoctor) {
    return 'follow_up'
  }

  return 'general'
}

/**
 * Get the preparation template for a visit type.
 */
export function getVisitTemplate(type: VisitType): VisitPrepTemplate {
  return TEMPLATES[type]
}

const TEMPLATES: Record<VisitType, VisitPrepTemplate> = {
  first_oncology: {
    type: 'first_oncology',
    label: 'First Oncology Visit',
    questions: [
      'What type and stage of cancer do I/they have?',
      'What are the treatment options, and what do you recommend?',
      'What is the expected timeline for treatment?',
      'What are the side effects of each treatment option?',
      'Will I need surgery, radiation, chemotherapy, or a combination?',
      'What is the prognosis with and without treatment?',
      'Should I get a second opinion? Do you recommend anyone?',
      'Are there any clinical trials I should consider?',
      'How will this affect my daily life and ability to work?',
      'What genetic or molecular testing should be done on the tumor?',
      'How often will I need to come in for treatment/check-ups?',
    ],
    things_to_bring: [
      'Photo ID and insurance cards',
      'Complete list of current medications (including supplements and OTC)',
      'All imaging CDs/reports from other facilities',
      'Pathology reports and biopsy results',
      'List of allergies',
      'Family cancer history (who, what type, what age)',
      'A notebook and pen for notes',
      'A trusted person for emotional support and to help remember details',
    ],
    prep_tasks: [
      'Write down your questions in advance — you WILL forget them during the appointment',
      'Gather all medical records from referring doctor',
      'Ask if you need to fast or stop any medications before the visit',
      'Bring a phone to record the conversation (ask permission first)',
      'Plan for a longer appointment (1-2 hours for initial consultations)',
    ],
  },

  follow_up: {
    type: 'follow_up',
    label: 'Follow-Up Visit',
    questions: [
      'How are my latest test results? Any changes from last time?',
      'Is the treatment working as expected?',
      'Should we adjust any medications or dosages?',
      'Are the side effects I\'m experiencing normal?',
      'When should I be concerned enough to call between visits?',
      'Any new symptoms I should watch for?',
    ],
    things_to_bring: [
      'Updated medication list (including any changes since last visit)',
      'Symptom journal or log of side effects since last visit',
      'Questions that came up since last visit',
      'Insurance cards (in case of changes)',
    ],
    prep_tasks: [
      'Review notes from last visit',
      'Write down any new symptoms or side effects',
      'Note any medications you missed or had trouble with',
      'Track pain levels and energy for the week before the visit',
    ],
  },

  new_specialist: {
    type: 'new_specialist',
    label: 'New Specialist Visit',
    questions: [
      'What is your experience treating this type/stage of cancer?',
      'Do you agree with the current treatment plan?',
      'What additional tests or assessments do you recommend?',
      'How will you coordinate with my other doctors?',
      'What should I expect from treatment under your care?',
      'How do I reach you or your team for urgent questions?',
    ],
    things_to_bring: [
      'Referral letter from your primary doctor',
      'Complete medical history summary',
      'All current medications with dosages',
      'Recent lab results and imaging',
      'Insurance referral authorization (if required)',
      'List of all current doctors and their specialties',
    ],
    prep_tasks: [
      'Request records transfer from current doctors',
      'Verify the specialist is in-network with your insurance',
      'Check if you need a referral or prior authorization',
      'Write a 1-page timeline of your cancer journey so far',
    ],
  },

  er_visit: {
    type: 'er_visit',
    label: 'Emergency Room Visit',
    questions: [
      'Is this related to my cancer treatment?',
      'Will you contact my oncologist?',
      'What medications are you giving me? Do they interact with my chemo?',
      'Do I need to be admitted?',
      'When can I resume my normal medications?',
    ],
    things_to_bring: [
      'Current medication list (CRITICAL — ER needs this)',
      'Insurance cards',
      'Oncologist\'s name and contact number',
      'List of known allergies',
      'Advance directive / healthcare proxy (if applicable)',
      'Phone charger',
    ],
    prep_tasks: [
      'Call your oncologist\'s on-call line BEFORE going to the ER if possible',
      'Tell the ER triage nurse immediately that you are a cancer patient on treatment',
      'Know your most recent blood counts (ANC especially)',
      'If you have a port, mention it so they can use it for blood draws',
    ],
  },

  infusion: {
    type: 'infusion',
    label: 'Infusion/Chemo Day',
    questions: [
      'How long will today\'s infusion take?',
      'Any changes to my regimen based on recent labs?',
      'What side effects should I expect in the next 3-5 days?',
      'When is my nadir (lowest blood counts) expected?',
      'Should I take my anti-nausea meds on a schedule or as-needed?',
    ],
    things_to_bring: [
      'Comfortable clothes (easy arm access for IV)',
      'Warm blanket or jacket (infusion rooms are cold)',
      'Snacks and water',
      'Entertainment (book, tablet, headphones)',
      'Anti-nausea medication (in case you need it on the way home)',
      'A driver (you may not be able to drive after)',
      'Phone charger',
    ],
    prep_tasks: [
      'Check if blood work was done before today — they may need labs first',
      'Take any pre-medications as instructed (steroids, anti-nausea)',
      'Eat a light meal before the infusion',
      'Hydrate well the day before and day of',
      'Confirm your ride home',
    ],
  },

  scan_results: {
    type: 'scan_results',
    label: 'Scan Results Review',
    questions: [
      'What do the results show? Has the tumor grown, shrunk, or stayed the same?',
      'How do these results compare to the last scan?',
      'Does this change the treatment plan?',
      'Are there any new areas of concern?',
      'What is the next step based on these results?',
      'When is the next scan scheduled?',
      'If results are good: how long do we continue the current treatment?',
      'If results are concerning: what are the options?',
    ],
    things_to_bring: [
      'Previous scan reports for comparison',
      'A notebook for detailed notes',
      'A support person — scan result days are emotionally heavy',
      'Questions written in advance (you may be overwhelmed in the moment)',
    ],
    prep_tasks: [
      'Prepare yourself emotionally — both good and bad news are possible',
      'Have your support person ready to help take notes',
      'Review your previous scan results so you can compare',
      'Write down your questions — you will forget them when emotions hit',
    ],
  },

  second_opinion: {
    type: 'second_opinion',
    label: 'Second Opinion Consultation',
    questions: [
      'Based on my records, do you agree with the current diagnosis and staging?',
      'Would you recommend a different treatment approach? Why?',
      'Are there clinical trials at your institution that might benefit me?',
      'What is your experience with this specific type of cancer?',
      'If you were in my position, what would you do?',
      'Are there any tests or evaluations my current team hasn\'t done?',
    ],
    things_to_bring: [
      'Complete medical records from current oncologist',
      'All imaging CDs (not just reports — actual scans)',
      'Pathology slides (request from the lab that processed your biopsy)',
      'Current treatment plan documentation',
      'Timeline of treatment so far',
      'List of questions specific to your case',
    ],
    prep_tasks: [
      'Request records at least 2 weeks before the appointment',
      'Ask your current oncologist for pathology slides specifically',
      'Don\'t feel guilty — second opinions are normal and expected',
      'Prepare a concise 1-page cancer timeline (diagnosis date, treatments, responses)',
      'Check insurance coverage for second opinions at this facility',
    ],
  },

  general: {
    type: 'general',
    label: 'General Doctor Visit',
    questions: [
      'How are my overall health indicators looking?',
      'Any concerns based on recent labs or exams?',
      'Should I adjust any medications?',
      'What preventive care should I be doing?',
      'When should I follow up?',
    ],
    things_to_bring: [
      'Current medication list',
      'Insurance cards',
      'List of questions or concerns',
      'Symptom log if applicable',
    ],
    prep_tasks: [
      'Write down your top 3 concerns in order of priority',
      'Update your medication list if anything changed',
      'Note any new symptoms since your last visit',
    ],
  },
}
