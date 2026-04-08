'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { LabResult } from '@/lib/types'
import { parseLabValue } from '@/lib/lab-parsing'

interface LabTestInfo {
  description: string
  lowMeaning: string
  highMeaning: string
  advice: string
}

const LAB_TEST_KNOWLEDGE: Record<string, LabTestInfo> = {
  WBC: {
    description:
      'White Blood Cell count measures the number of infection-fighting cells in your blood. It is a key indicator of immune system health, especially during cancer treatment.',
    lowMeaning:
      'A low WBC (leukopenia) means your immune system is weakened. You may be more vulnerable to infections. This is common during chemotherapy.',
    highMeaning:
      'A high WBC (leukocytosis) can indicate infection, inflammation, or stress. In some cases it may be related to certain blood cancers.',
    advice:
      'If low, avoid crowds and sick contacts, wash hands frequently, and report any fever above 100.4\u00b0F immediately. If high, your care team will investigate the cause.',
  },
  RBC: {
    description:
      'Red Blood Cell count measures the cells that carry oxygen throughout your body. Adequate RBC levels are essential for energy and organ function.',
    lowMeaning:
      'A low RBC count (anemia) can cause fatigue, weakness, shortness of breath, and pale skin. Chemotherapy commonly lowers RBC counts.',
    highMeaning:
      'A high RBC count (polycythemia) can thicken blood and increase clot risk. It may be related to dehydration or other conditions.',
    advice:
      'If low, rest when tired, rise slowly from sitting, and eat iron-rich foods. Report severe fatigue or dizziness to your care team.',
  },
  Hemoglobin: {
    description:
      'Hemoglobin is the protein in red blood cells that carries oxygen. It is one of the most important measures of your blood health.',
    lowMeaning:
      'Low hemoglobin (anemia) causes fatigue, weakness, and shortness of breath. Treatment may include iron supplements or transfusions.',
    highMeaning:
      'High hemoglobin can indicate dehydration, lung disease, or other conditions. Your care team will evaluate the cause.',
    advice:
      'Stay hydrated, eat a balanced diet with iron-rich foods (leafy greens, lean meats), and report worsening fatigue or chest pain.',
  },
  Platelets: {
    description:
      'Platelets help your blood clot to stop bleeding. Cancer treatment can significantly affect platelet counts.',
    lowMeaning:
      'Low platelets (thrombocytopenia) increase bleeding risk. You may bruise easily or bleed longer from cuts. This is common during chemo.',
    highMeaning:
      'High platelets (thrombocytosis) can increase clot risk. It may be reactive to inflammation or related to a blood disorder.',
    advice:
      'If low, avoid contact sports, use a soft toothbrush, and report unusual bruising, nosebleeds, or blood in stool/urine immediately.',
  },
  ANC: {
    description:
      'Absolute Neutrophil Count measures your neutrophils, the most important white blood cells for fighting bacterial infections. This is a critical lab during chemotherapy.',
    lowMeaning:
      'Low ANC (neutropenia) means high infection risk. Below 500 is severe neutropenia and a medical emergency if fever develops.',
    highMeaning:
      'High ANC usually indicates your body is fighting an infection or responding to inflammation or medication (like steroids).',
    advice:
      'If ANC is below 1000, take neutropenic precautions: avoid raw foods, crowds, and sick contacts. Call your oncologist immediately for fever above 100.4\u00b0F.',
  },
  ALT: {
    description:
      'Alanine Aminotransferase is a liver enzyme. Elevated levels may indicate liver stress or damage, which can occur with certain cancer treatments.',
    lowMeaning:
      'Low ALT is generally normal and not a concern.',
    highMeaning:
      'High ALT suggests liver inflammation or damage. This can be caused by medications, chemotherapy, or other conditions.',
    advice:
      'Avoid alcohol, stay hydrated, and inform your care team about any new medications or supplements you are taking.',
  },
  AST: {
    description:
      'Aspartate Aminotransferase is an enzyme found in the liver and heart. It helps assess liver function during treatment.',
    lowMeaning:
      'Low AST is generally normal and not a concern.',
    highMeaning:
      'High AST may indicate liver damage, heart issues, or muscle injury. Certain chemo drugs can elevate AST.',
    advice:
      'Report any yellowing of skin or eyes, dark urine, or abdominal pain to your care team.',
  },
  Creatinine: {
    description:
      'Creatinine measures how well your kidneys filter waste from your blood. Kidney function monitoring is important during cancer treatment.',
    lowMeaning:
      'Low creatinine can indicate low muscle mass or liver issues but is rarely a primary concern.',
    highMeaning:
      'High creatinine suggests your kidneys may not be filtering well. Some chemo drugs can stress the kidneys.',
    advice:
      'Stay well hydrated, avoid NSAIDs (ibuprofen, naproxen) unless approved, and report swelling or decreased urination.',
  },
  BUN: {
    description:
      'Blood Urea Nitrogen measures waste product levels in your blood. Along with creatinine, it helps assess kidney function.',
    lowMeaning:
      'Low BUN may indicate overhydration or liver issues but is usually not a major concern.',
    highMeaning:
      'High BUN may indicate dehydration, kidney problems, or high-protein diet. Some cancer treatments can affect BUN.',
    advice:
      'Drink plenty of water, limit excessive protein intake, and monitor alongside creatinine for a complete kidney picture.',
  },
  Albumin: {
    description:
      'Albumin is a protein made by your liver. It reflects your nutritional status and liver function, both important during cancer care.',
    lowMeaning:
      'Low albumin (hypoalbuminemia) can indicate malnutrition, liver disease, or chronic illness. It is common in advanced cancer.',
    highMeaning:
      'High albumin is uncommon and usually related to dehydration.',
    advice:
      'Focus on adequate protein intake. If low, discuss nutritional supplements or dietitian referral with your care team.',
  },
  Calcium: {
    description:
      'Calcium is essential for bone health, muscle function, and nerve signaling. Some cancers can cause calcium imbalances.',
    lowMeaning:
      'Low calcium (hypocalcemia) can cause muscle cramps, tingling, and heart rhythm issues. Some treatments deplete calcium.',
    highMeaning:
      'High calcium (hypercalcemia) can be a sign of cancer spreading to bones. Symptoms include confusion, fatigue, and nausea.',
    advice:
      'If high, increase fluid intake and report confusion, excessive thirst, or constipation. If low, discuss calcium supplements with your doctor.',
  },
  Potassium: {
    description:
      'Potassium is critical for heart rhythm and muscle function. Certain cancer treatments and medications can affect levels.',
    lowMeaning:
      'Low potassium (hypokalemia) can cause weakness, cramps, and irregular heartbeat. Vomiting and certain drugs deplete potassium.',
    highMeaning:
      'High potassium (hyperkalemia) can cause dangerous heart rhythm changes. Kidney problems or cell breakdown can raise levels.',
    advice:
      'Report muscle weakness, cramps, or heart palpitations immediately. Eat potassium-rich foods (bananas, potatoes) if levels are low.',
  },
  Sodium: {
    description:
      'Sodium helps regulate fluid balance and nerve function. Imbalances can occur with cancer treatment side effects.',
    lowMeaning:
      'Low sodium (hyponatremia) causes confusion, nausea, and seizures in severe cases. It can occur with certain chemo drugs.',
    highMeaning:
      'High sodium (hypernatremia) usually indicates dehydration. Symptoms include extreme thirst and confusion.',
    advice:
      'Stay hydrated, monitor for confusion or severe headache, and follow your care team\u2019s fluid intake guidelines.',
  },
  Glucose: {
    description:
      'Glucose (blood sugar) measures the sugar level in your blood. Steroids used in cancer treatment can raise glucose significantly.',
    lowMeaning:
      'Low glucose (hypoglycemia) causes shakiness, sweating, confusion, and dizziness. Eat or drink something sugary immediately.',
    highMeaning:
      'High glucose (hyperglycemia) may be caused by steroids, stress, or diabetes. Persistent highs need management.',
    advice:
      'If on steroids, monitor blood sugar regularly. Report persistent readings above 200 or symptoms of low blood sugar to your team.',
  },
  HbA1c: {
    description:
      'HbA1c (glycated hemoglobin) reflects your average blood sugar over the past 2-3 months. Important for patients on steroid therapy.',
    lowMeaning:
      'Low HbA1c indicates well-controlled blood sugar. Rarely a concern unless hypoglycemia is frequent.',
    highMeaning:
      'High HbA1c indicates poor blood sugar control over time, increasing risk of complications. Steroid use can elevate it.',
    advice:
      'Discuss glucose management with your care team. A healthy diet, regular activity, and medication adjustment may help.',
  },
  TSH: {
    description:
      'Thyroid Stimulating Hormone measures thyroid function. Some cancer treatments, especially immunotherapy, can affect the thyroid.',
    lowMeaning:
      'Low TSH may indicate an overactive thyroid (hyperthyroidism), causing rapid heartbeat, weight loss, and anxiety.',
    highMeaning:
      'High TSH suggests an underactive thyroid (hypothyroidism), causing fatigue, weight gain, and cold sensitivity. Immunotherapy commonly causes this.',
    advice:
      'Report unexplained weight changes, fatigue, or temperature sensitivity. Thyroid medication may be needed.',
  },
  PSA: {
    description:
      'Prostate-Specific Antigen is used to monitor prostate cancer. It helps track treatment response and detect recurrence.',
    lowMeaning:
      'Low or undetectable PSA after treatment is a positive sign indicating good response.',
    highMeaning:
      'Rising PSA may indicate cancer recurrence or progression. Your oncologist will determine next steps.',
    advice:
      'Keep regular follow-up appointments. A single elevated reading may need confirmation with repeat testing.',
  },
  'CA-125': {
    description:
      'CA-125 is a tumor marker primarily used to monitor ovarian cancer treatment response and detect recurrence.',
    lowMeaning:
      'Low or declining CA-125 during treatment is a positive sign of response.',
    highMeaning:
      'Rising CA-125 may suggest cancer progression or recurrence. However, it can also be elevated by non-cancerous conditions.',
    advice:
      'Track the trend over multiple tests rather than focusing on a single value. Discuss changes with your oncologist.',
  },
  CEA: {
    description:
      'Carcinoembryonic Antigen is a tumor marker used to monitor colorectal, lung, and other cancers during and after treatment.',
    lowMeaning:
      'Low or stable CEA is a positive indicator during cancer monitoring.',
    highMeaning:
      'Rising CEA may suggest cancer progression or recurrence. Smoking can also elevate CEA.',
    advice:
      'Monitor the trend over time with your oncologist. A single elevated reading warrants follow-up but is not diagnostic alone.',
  },
  AFP: {
    description:
      'Alpha-Fetoprotein is a tumor marker used to monitor liver cancer and certain germ cell tumors.',
    lowMeaning:
      'Low or declining AFP during treatment is a positive sign.',
    highMeaning:
      'Rising AFP may indicate tumor growth or recurrence. Liver inflammation can also elevate AFP.',
    advice:
      'Discuss trends with your oncologist. AFP is most meaningful when tracked over multiple tests.',
  },
}

/** Normalize test names to match our knowledge map keys */
function resolveTestKey(testName: string): string | null {
  const normalized = testName.trim()
  // Exact match
  if (LAB_TEST_KNOWLEDGE[normalized]) return normalized

  const lower = normalized.toLowerCase()
  // Check lowercase keys
  for (const key of Object.keys(LAB_TEST_KNOWLEDGE)) {
    if (key.toLowerCase() === lower) return key
  }
  // Common aliases
  const aliases: Record<string, string> = {
    'white blood cell': 'WBC',
    'white blood cells': 'WBC',
    'wbc count': 'WBC',
    'red blood cell': 'RBC',
    'red blood cells': 'RBC',
    'rbc count': 'RBC',
    hgb: 'Hemoglobin',
    hb: 'Hemoglobin',
    hemoglobin: 'Hemoglobin',
    haemoglobin: 'Hemoglobin',
    plt: 'Platelets',
    'platelet count': 'Platelets',
    platelets: 'Platelets',
    'absolute neutrophil count': 'ANC',
    neutrophils: 'ANC',
    'anc count': 'ANC',
    'alanine aminotransferase': 'ALT',
    sgpt: 'ALT',
    'aspartate aminotransferase': 'AST',
    sgot: 'AST',
    creatinine: 'Creatinine',
    'serum creatinine': 'Creatinine',
    bun: 'BUN',
    'blood urea nitrogen': 'BUN',
    albumin: 'Albumin',
    'serum albumin': 'Albumin',
    calcium: 'Calcium',
    'serum calcium': 'Calcium',
    potassium: 'Potassium',
    'serum potassium': 'Potassium',
    sodium: 'Sodium',
    'serum sodium': 'Sodium',
    glucose: 'Glucose',
    'fasting glucose': 'Glucose',
    'blood glucose': 'Glucose',
    'blood sugar': 'Glucose',
    hba1c: 'HbA1c',
    'a1c': 'HbA1c',
    'hemoglobin a1c': 'HbA1c',
    'glycated hemoglobin': 'HbA1c',
    tsh: 'TSH',
    'thyroid stimulating hormone': 'TSH',
    psa: 'PSA',
    'prostate specific antigen': 'PSA',
    'ca-125': 'CA-125',
    'ca 125': 'CA-125',
    ca125: 'CA-125',
    cea: 'CEA',
    'carcinoembryonic antigen': 'CEA',
    afp: 'AFP',
    'alpha fetoprotein': 'AFP',
    'alpha-fetoprotein': 'AFP',
  }

  return aliases[lower] ?? null
}

function getResultStatus(
  numericValue: number | null,
  referenceMin: number | null,
  referenceMax: number | null,
  isAbnormal: boolean
): 'normal' | 'low' | 'high' | 'unknown' {
  if (numericValue === null) return isAbnormal ? 'high' : 'unknown'
  if (referenceMin !== null && numericValue < referenceMin) return 'low'
  if (referenceMax !== null && numericValue > referenceMax) return 'high'
  if (isAbnormal) return numericValue < (referenceMin ?? 0) ? 'low' : 'high'
  return 'normal'
}

function statusColor(status: 'normal' | 'low' | 'high' | 'unknown'): string {
  switch (status) {
    case 'normal':
      return '#10b981'
    case 'low':
    case 'high':
      return '#ef4444'
    default:
      return '#a78bfa'
  }
}

function statusLabel(status: 'normal' | 'low' | 'high' | 'unknown'): string {
  switch (status) {
    case 'normal':
      return 'Normal'
    case 'low':
      return 'Low'
    case 'high':
      return 'High'
    default:
      return 'Unknown'
  }
}

/* ------------------------------------------------------------------ */
/*  Gauge component                                                    */
/* ------------------------------------------------------------------ */

function LabGauge({
  numericValue,
  referenceMin,
  referenceMax,
  status,
}: {
  numericValue: number | null
  referenceMin: number | null
  referenceMax: number | null
  status: 'normal' | 'low' | 'high' | 'unknown'
}) {
  if (numericValue === null || referenceMax === null) return null

  const min = referenceMin ?? 0
  const max = referenceMax
  // Expand range for visualization — 20% padding each side
  const rangePadding = (max - min) * 0.2
  const vizMin = min - rangePadding
  const vizMax = max + rangePadding
  const vizSpan = vizMax - vizMin

  const normalStart = ((min - vizMin) / vizSpan) * 100
  const normalEnd = ((max - vizMin) / vizSpan) * 100
  const markerPos = Math.max(0, Math.min(100, ((numericValue - vizMin) / vizSpan) * 100))

  return (
    <div className="w-full mt-2 mb-1">
      {/* Labels */}
      <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1 font-mono">
        <span>{min.toFixed(1)}</span>
        <span>{max.toFixed(1)}</span>
      </div>

      {/* Gauge track */}
      <div className="relative w-full h-2 rounded-full overflow-hidden bg-white/[0.06]">
        {/* Red low zone */}
        <div
          className="absolute inset-y-0 left-0 rounded-l-full"
          style={{
            width: `${normalStart}%`,
            background: 'linear-gradient(90deg, rgba(239,68,68,0.35), rgba(245,158,11,0.3))',
          }}
        />
        {/* Green normal zone */}
        <div
          className="absolute inset-y-0"
          style={{
            left: `${normalStart}%`,
            width: `${normalEnd - normalStart}%`,
            background: 'linear-gradient(90deg, rgba(16,185,129,0.4), rgba(16,185,129,0.5), rgba(16,185,129,0.4))',
          }}
        />
        {/* Red high zone */}
        <div
          className="absolute inset-y-0 right-0 rounded-r-full"
          style={{
            left: `${normalEnd}%`,
            width: `${100 - normalEnd}%`,
            background: 'linear-gradient(90deg, rgba(245,158,11,0.3), rgba(239,68,68,0.35))',
          }}
        />
      </div>

      {/* Marker */}
      <div className="relative w-full h-0">
        <div
          className="absolute -top-[11px] -translate-x-1/2 flex flex-col items-center"
          style={{ left: `${markerPos}%` }}
        >
          <div
            className="w-3.5 h-3.5 rounded-full border-2 shadow-lg"
            style={{
              borderColor: statusColor(status),
              backgroundColor: statusColor(status),
              boxShadow: `0 0 8px ${statusColor(status)}66`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function LabInterpretation({ labResult }: { labResult: LabResult }) {
  const [expanded, setExpanded] = useState(false)

  const parsed = parseLabValue(labResult.value, labResult.reference_range)
  const testKey = resolveTestKey(labResult.test_name)
  const info = testKey ? LAB_TEST_KNOWLEDGE[testKey] : null
  const status = getResultStatus(
    parsed.numericValue,
    parsed.referenceMin,
    parsed.referenceMax,
    labResult.is_abnormal
  )

  const chatPrompt = encodeURIComponent(
    `I just got my ${labResult.test_name} result: ${labResult.value} ${labResult.unit ?? ''}. The reference range is ${labResult.reference_range ?? 'not specified'}. Can you help me understand what this means for my health and if I should be concerned?`
  )

  return (
    <div
      className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] overflow-hidden transition-all duration-300"
    >
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="w-full text-left p-4 flex items-start gap-3 cursor-pointer focus:outline-none"
      >
        {/* Status dot */}
        <div className="mt-1 flex-shrink-0">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: statusColor(status),
              boxShadow: `0 0 6px ${statusColor(status)}55`,
            }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-[var(--text)] text-sm">
              {labResult.test_name}
            </span>
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded-full"
              style={{
                color: statusColor(status),
                backgroundColor: `${statusColor(status)}18`,
              }}
            >
              {statusLabel(status)}
            </span>
          </div>

          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg font-bold text-[var(--text)] tabular-nums">
              {parsed.displayValue}
            </span>
            {labResult.unit && (
              <span className="text-xs text-[var(--text-muted)]">{labResult.unit}</span>
            )}
            {labResult.reference_range && (
              <span className="text-[11px] text-[var(--text-muted)] ml-2">
                Ref: {labResult.reference_range}
              </span>
            )}
          </div>

          {/* Gauge */}
          <LabGauge
            numericValue={parsed.numericValue}
            referenceMin={parsed.referenceMin}
            referenceMax={parsed.referenceMax}
            status={status}
          />
        </div>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 mt-1 flex-shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            expanded ? 'rotate-180 text-[#A78BFA]' : 'text-[var(--text-muted)]'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Expanded interpretation */}
      <div
        className="transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden"
        style={{
          maxHeight: expanded ? '600px' : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="px-4 pb-4 space-y-4 border-t border-white/[0.06]">
          {info ? (
            <>
              {/* What this test measures */}
              <div className="pt-4">
                <h4 className="text-xs font-semibold text-[#A78BFA] uppercase tracking-wider mb-1.5">
                  What this test measures
                </h4>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  {info.description}
                </p>
              </div>

              {/* Your result */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: statusColor(status) }}>
                  Your result
                </h4>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  {status === 'normal'
                    ? 'Your result is within the normal reference range. This is a good sign.'
                    : status === 'low'
                      ? info.lowMeaning
                      : status === 'high'
                        ? info.highMeaning
                        : 'We could not determine whether this result is within range. Please consult your care team.'}
                </p>
              </div>

              {/* What to do */}
              <div>
                <h4 className="text-xs font-semibold text-[#6366F1] uppercase tracking-wider mb-1.5">
                  What to do
                </h4>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  {info.advice}
                </p>
              </div>
            </>
          ) : (
            <div className="pt-4">
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                We don&apos;t have detailed interpretation data for this test. Ask your doctor or care team about what your{' '}
                <strong className="text-[var(--text)]">{labResult.test_name}</strong> result means for your situation.
              </p>
            </div>
          )}

          {/* Discuss with AI button */}
          <Link
            href={`/chat?prompt=${chatPrompt}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 bg-[#6366F1]/15 text-[#A78BFA] hover:bg-[#6366F1]/25 active:scale-[0.98]"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            Discuss with AI
          </Link>
        </div>
      </div>
    </div>
  )
}
