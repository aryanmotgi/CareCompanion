// Eval fixture: 40 memories (slugs are stable, not UUIDs — keyed via
// memories.slug column added in migration 014/015).

export type EvalMemory = {
  slug: string;
  fact: string;
  category: string;
  polarity: 'asserted' | 'negated';
  status: 'active' | 'historical' | 'denied';
  importance: number;
  tier: number;
  subject?: string;
};

export const EVAL_MEMORIES: EvalMemory[] = [
  // Safety / Tier 1 (8)
  { slug: 'allergy-pcn',          fact: 'Eleanor is allergic to penicillin',                       category: 'allergy',           polarity: 'asserted', status: 'active',     importance: 1.0, tier: 1 },
  { slug: 'allergy-nsaid',        fact: 'Eleanor is allergic to NSAIDs including ibuprofen',       category: 'allergy',           polarity: 'asserted', status: 'active',     importance: 1.0, tier: 1 },
  { slug: 'allergy-sulfa-neg',    fact: 'Patient denies any sulfa allergy',                        category: 'allergy',           polarity: 'negated',  status: 'active',     importance: 0.5, tier: 3 },
  { slug: 'cond-breast-cancer',   fact: 'Eleanor has stage 2 HER2+ breast cancer',                 category: 'condition',         polarity: 'asserted', status: 'active',     importance: 1.0, tier: 1 },
  { slug: 'cond-htn',             fact: 'Eleanor has hypertension',                                category: 'condition',         polarity: 'asserted', status: 'active',     importance: 0.9, tier: 1 },
  { slug: 'cond-ckd',             fact: 'Eleanor has CKD stage 3',                                 category: 'condition',         polarity: 'asserted', status: 'active',     importance: 0.9, tier: 1 },
  { slug: 'med-tamoxifen-active', fact: 'Eleanor takes Tamoxifen 20mg daily',                      category: 'medication',        polarity: 'asserted', status: 'active',     importance: 0.9, tier: 1 },
  { slug: 'med-metformin',        fact: 'Eleanor takes Metformin 500mg twice daily',               category: 'medication',        polarity: 'asserted', status: 'active',     importance: 0.9, tier: 1 },

  // Historical / denied medication (3)
  { slug: 'med-tamoxifen-old',    fact: 'Eleanor took Tamoxifen 10mg until 2025-11',               category: 'medication',        polarity: 'asserted', status: 'historical', importance: 0.5, tier: 3 },
  { slug: 'med-statin-denied',    fact: 'Eleanor refused statin therapy',                          category: 'medication',        polarity: 'asserted', status: 'denied',     importance: 0.6, tier: 3 },
  { slug: 'med-chemo-old',        fact: 'Eleanor completed FOLFOX cycles 1-4 in 2025',             category: 'medication',        polarity: 'asserted', status: 'historical', importance: 0.6, tier: 3 },

  // Lab results — time series (4)
  { slug: 'lab-cea-19',           fact: 'CEA on 2026-01-15 was 19.2 ng/mL',                        category: 'lab_result',        polarity: 'asserted', status: 'active',     importance: 0.7, tier: 2 },
  { slug: 'lab-cea-28',           fact: 'CEA on 2026-03-15 was 28.4 ng/mL',                        category: 'lab_result',        polarity: 'asserted', status: 'active',     importance: 0.7, tier: 2 },
  { slug: 'lab-cea-45',           fact: 'CEA on 2026-05-10 was 45.1 ng/mL ABNORMAL',               category: 'lab_result',        polarity: 'asserted', status: 'active',     importance: 0.8, tier: 2 },
  { slug: 'lab-hgb-low',          fact: 'Hemoglobin on 2026-05-10 was 9.2 (anemia)',               category: 'lab_result',        polarity: 'asserted', status: 'active',     importance: 0.7, tier: 2 },

  // Appointments / providers (5)
  { slug: 'appt-onco-next',       fact: 'Next oncology appointment scheduled with Dr. Patel',      category: 'appointment',       polarity: 'asserted', status: 'active',     importance: 0.7, tier: 2 },
  { slug: 'provider-oncologist',  fact: "Dr. Anjali Patel is Eleanor's oncologist",                category: 'provider',          polarity: 'asserted', status: 'active',     importance: 0.6, tier: 2 },
  { slug: 'provider-pcp',         fact: "Dr. Mark Chen is Eleanor's primary care physician",       category: 'provider',          polarity: 'asserted', status: 'active',     importance: 0.5, tier: 2 },
  { slug: 'appt-pcp-old',         fact: 'Saw PCP for annual physical 2025-12-15',                  category: 'appointment',       polarity: 'asserted', status: 'historical', importance: 0.3, tier: 3 },
  { slug: 'provider-radiologist', fact: "Dr. Sara Lin reads Eleanor's mammograms",                 category: 'provider',          polarity: 'asserted', status: 'active',     importance: 0.4, tier: 2 },

  // Emotional state / caregiver (6)
  { slug: 'cg-burnout-1',         fact: 'Caregiver feels exhausted from 3-month treatment',        category: 'emotional_state',   polarity: 'asserted', status: 'active',     importance: 0.6, tier: 3, subject: 'caregiver' },
  { slug: 'cg-burnout-2',         fact: 'Caregiver had trouble sleeping last week',                category: 'emotional_state',   polarity: 'asserted', status: 'active',     importance: 0.5, tier: 3, subject: 'caregiver' },
  { slug: 'cg-isolation',         fact: 'Caregiver feels isolated; sister lives across country',   category: 'family',            polarity: 'asserted', status: 'active',     importance: 0.5, tier: 3, subject: 'caregiver' },
  { slug: 'pt-anxious-mri',       fact: 'Eleanor was anxious before her last MRI',                 category: 'emotional_state',   polarity: 'asserted', status: 'active',     importance: 0.4, tier: 3 },
  { slug: 'pt-good-mood',         fact: 'Eleanor reported feeling more energetic this week',       category: 'emotional_state',   polarity: 'asserted', status: 'active',     importance: 0.3, tier: 3 },
  { slug: 'family-husband',       fact: "Eleanor's husband Tom drives her to appointments",        category: 'family',            polarity: 'asserted', status: 'active',     importance: 0.4, tier: 3 },

  // Preferences (3)
  { slug: 'pref-warm-tone',       fact: 'Caregiver prefers a warm conversational tone',            category: 'preference',        polarity: 'asserted', status: 'active',     importance: 0.3, tier: 3, subject: 'caregiver' },
  { slug: 'pref-no-jargon',       fact: 'User prefers plain language over medical jargon',         category: 'preference',        polarity: 'asserted', status: 'active',     importance: 0.3, tier: 3 },
  { slug: 'pref-jazz',            fact: 'Eleanor enjoys jazz music',                                category: 'preference',        polarity: 'asserted', status: 'active',     importance: 0.2, tier: 3 },

  // Insurance / financial (3)
  { slug: 'ins-claim-denied',     fact: 'Aetna denied claim for Tamoxifen refill on 2026-04',     category: 'insurance',         polarity: 'asserted', status: 'active',     importance: 0.6, tier: 3 },
  { slug: 'fin-fsa-low',          fact: 'FSA balance is $230 with $200 remaining contribution',    category: 'financial',         polarity: 'asserted', status: 'active',     importance: 0.4, tier: 3 },
  { slug: 'ins-priorauth-onco',   fact: 'Prior auth approved for oncology visits through 2026-12', category: 'insurance',        polarity: 'asserted', status: 'active',     importance: 0.5, tier: 3 },

  // Legal / lifestyle / other (8)
  { slug: 'legal-poa',            fact: 'Tom holds power of attorney for healthcare decisions',    category: 'legal',             polarity: 'asserted', status: 'active',     importance: 0.6, tier: 3 },
  { slug: 'lifestyle-vegetarian', fact: 'Eleanor is vegetarian',                                    category: 'lifestyle',         polarity: 'asserted', status: 'active',     importance: 0.3, tier: 3 },
  { slug: 'lifestyle-walks',      fact: 'Eleanor walks 20 min/day for energy',                     category: 'lifestyle',         polarity: 'asserted', status: 'active',     importance: 0.3, tier: 3 },
  { slug: 'family-son',           fact: 'Eleanor has a son Marcus who lives in Boston',            category: 'family',            polarity: 'asserted', status: 'active',     importance: 0.3, tier: 3 },
  { slug: 'pt-no-diabetes',       fact: 'Eleanor has never had diabetes',                          category: 'condition',         polarity: 'negated',  status: 'active',     importance: 0.5, tier: 3 },
  { slug: 'pt-no-smoking',        fact: 'Eleanor has never smoked',                                category: 'lifestyle',         polarity: 'negated',  status: 'active',     importance: 0.4, tier: 3 },
  { slug: 'other-mri-suite',      fact: 'MRI was performed at Mass General radiology suite 4',     category: 'other',             polarity: 'asserted', status: 'active',     importance: 0.2, tier: 3 },
  { slug: 'tx-fatigue-mod',       fact: 'Eleanor reports moderate fatigue after each cycle',       category: 'treatment_response', polarity: 'asserted', status: 'active',    importance: 0.6, tier: 3 },
];

export type EvalQuery = {
  id: string;
  query: string;
  expected: string[];
  mustTier1: string[];
};

export const EVAL_QUERIES: EvalQuery[] = [
  { id: 'Q1',  query: 'Can mom take ibuprofen for her headache?',
    expected: ['allergy-nsaid', 'cond-ckd', 'med-metformin'],
    mustTier1: ['allergy-nsaid'] },
  { id: 'Q2',  query: 'How is her CEA trending?',
    expected: ['lab-cea-45', 'lab-cea-28', 'lab-cea-19'],
    mustTier1: [] },
  { id: 'Q3',  query: "I'm exhausted, what should I do?",
    expected: ['cg-burnout-1', 'cg-burnout-2', 'cg-isolation', 'pref-warm-tone'],
    mustTier1: [] },
  { id: 'Q4',  query: 'Hi, good morning',
    expected: [],
    mustTier1: ['allergy-pcn', 'allergy-nsaid', 'cond-breast-cancer', 'med-tamoxifen-active'] },
  { id: 'Q5',  query: 'My mom is allergic to penicillin right?',
    expected: ['allergy-pcn'],
    mustTier1: ['allergy-pcn'] },
  { id: 'Q6',  query: 'Who is her oncologist?',
    expected: ['provider-oncologist', 'appt-onco-next'],
    mustTier1: [] },
  { id: 'Q7',  query: 'What meds did she used to take?',
    expected: ['med-tamoxifen-old', 'med-chemo-old'],
    mustTier1: [] },
  { id: 'Q8',  query: 'Why did the insurance claim get denied?',
    expected: ['ins-claim-denied', 'med-tamoxifen-active'],
    mustTier1: [] },
  { id: 'Q9',  query: 'Tell me about her chemo regimen',
    expected: ['med-chemo-old', 'tx-fatigue-mod'],
    mustTier1: [] },
  { id: 'Q10', query: 'Did she ever have diabetes?',
    expected: ['pt-no-diabetes'],
    mustTier1: [] },
  { id: 'Q11', query: 'What lab results are abnormal?',
    expected: ['lab-cea-45', 'lab-hgb-low'],
    mustTier1: [] },
  { id: 'Q12', query: 'How is her mood lately?',
    expected: ['pt-good-mood', 'pt-anxious-mri', 'cg-burnout-2'],
    mustTier1: [] },
];

export const EVAL_USER_ID = '00000000-0000-0000-0000-000000000eee';
export const EVAL_PROFILE_ID = '00000000-0000-0000-0000-000000000fff';
