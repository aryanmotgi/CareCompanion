import { db } from '@/lib/db'
import {
  careProfiles, medications, labResults,
  mutations as mutationsTable, treatmentCycles,
} from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

export type MutationConfidence = 'high' | 'medium' | 'low'

export type EligibilityGap = {
  gapType:       'measurable' | 'conditional' | 'fixed'
  description:   string
  metric:        string | null
  currentValue:  string | null
  requiredValue: string | null
  unit:          string | null
  verifiable:    boolean
  closureSignal: string | null
}

export type LabResultEntry = {
  testName:     string
  numericValue: number | null
  unit:         string | null
  resultDate:   string
  isAbnormal:   boolean
}

export type PriorTreatmentLine = {
  regimen:    string
  startDate:  string
  cycleCount: number
}

export type PatientProfile = {
  cancerType:          string | null
  cancerStage:         string | null
  age:                 number | null
  zipCode:             string | null
  city:                string | null
  state:               string | null
  mutations:           Array<{ name: string; status: string; source: string; confidence: MutationConfidence }>
  currentMedications:  string[]
  labResults:          LabResultEntry[]
  priorTreatmentLines: PriorTreatmentLine[]
  activeTreatment:     { regimen: string; startDate: string; cycleNumber: number } | null
  conditions:          string | null
  allergies:           string | null
}

export function deriveConfidence(source: string): MutationConfidence {
  if (source === 'lab_report') return 'high'
  if (source === 'fhir') return 'medium'
  return 'low'
}

export function validateZip(zip: string | null | undefined): boolean {
  if (!zip) return false
  return /^\d{5}$/.test(zip)
}

export function buildPriorTreatmentLines(
  cycles: Array<{ regimenName: string | null; startDate: string; cycleNumber: number; isActive: boolean }>
): PriorTreatmentLine[] {
  const prior = cycles.filter(c => !c.isActive && c.regimenName)
  // Groups by regimenName only (not startDate) — same regimen = one prior line regardless of date gaps.
  // startDate comes from the cycle with the highest cycleNumber in that group.
  const grouped: Record<string, { startDate: string; maxCycle: number }> = {}
  for (const c of prior) {
    const key = c.regimenName!
    if (!grouped[key] || c.cycleNumber > grouped[key].maxCycle) {
      grouped[key] = { startDate: c.startDate, maxCycle: c.cycleNumber }
    }
  }
  return Object.entries(grouped).map(([regimen, { startDate, maxCycle }]) => ({
    regimen,
    startDate,
    cycleCount: maxCycle,
  }))
}

export async function assembleProfile(careProfileId: string): Promise<PatientProfile> {
  const [profile] = await db.select().from(careProfiles)
    .where(eq(careProfiles.id, careProfileId)).limit(1)
  if (!profile) throw new Error(`careProfile not found: ${careProfileId}`)

  const [meds, labs, muts, cycles] = await Promise.all([
    db.select().from(medications)
      .where(and(eq(medications.careProfileId, careProfileId), isNull(medications.deletedAt))),
    // labResults is user-scoped; join via the careProfile's userId
    db.select().from(labResults)
      .where(and(eq(labResults.userId, profile.userId), isNull(labResults.deletedAt))),
    db.select().from(mutationsTable).where(eq(mutationsTable.careProfileId, careProfileId)),
    db.select().from(treatmentCycles).where(eq(treatmentCycles.careProfileId, careProfileId)),
  ])

  const activeCycle = cycles.find(c => c.isActive) ?? null

  return {
    cancerType:   profile.cancerType,
    cancerStage:  profile.cancerStage,
    age:          profile.patientAge,
    zipCode:      validateZip(profile.zipCode) ? profile.zipCode! : null,
    city:         profile.city ?? null,
    state:        profile.state ?? null,
    mutations: muts.map(m => ({
      name:       m.mutationName,
      status:     m.status,
      source:     m.source,
      confidence: deriveConfidence(m.source),
    })),
    currentMedications: meds.map(m => m.name),
    labResults: labs.map(l => {
      const numeric = parseFloat(l.value ?? '')
      return {
        testName:     l.testName,
        numericValue: isNaN(numeric) ? null : numeric,
        unit:         l.unit ?? null,
        resultDate:   l.dateTaken ?? 'Date unknown',
        isAbnormal:   l.isAbnormal ?? false,
      }
    }),
    priorTreatmentLines: buildPriorTreatmentLines(cycles),
    activeTreatment: activeCycle ? {
      regimen:     activeCycle.regimenName ?? '',
      startDate:   activeCycle.startDate,
      cycleNumber: activeCycle.cycleNumber,
    } : null,
    conditions: profile.conditions,
    allergies:  profile.allergies,
  }
}
