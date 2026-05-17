/**
 * FHIR → HealthKitRecord normalisers. Pure data transforms — no RN or Expo
 * imports — so vitest can load them under Node without stubbing native bridges.
 *
 * Type-only imports from @carecompanion/types are erased at runtime; the
 * package is compile-only and ships no JS.
 */
import type {
  HealthKitMedicationRecord,
  HealthKitLabRecord,
  HealthKitVitalSignRecord,
} from '@carecompanion/types'

// ---------------------------------------------------------------------------
// Mobile-local extended record types not yet promoted to @carecompanion/types.
// When the shared union grows to include these, import and drop the local copy.
// ---------------------------------------------------------------------------

export type HealthKitConditionRecord = {
  type: 'condition'
  healthkitFhirId: string
  code: string | null
  display: string
  clinicalStatus: string | null
  onsetDateTime: string | null
}

export type HealthKitAllergyRecord = {
  type: 'allergy'
  healthkitFhirId: string
  code: string | null
  display: string
  reaction: string | null
  criticality: string | null
}

export type HealthKitProcedureRecord = {
  type: 'procedure'
  healthkitFhirId: string
  code: string | null
  display: string
  performedDateTime: string | null
}

export type HealthKitImmunizationRecord = {
  type: 'immunization'
  healthkitFhirId: string
  code: string | null
  display: string
  occurrenceDateTime: string | null
}

export type ExtendedHealthKitRecord =
  | HealthKitMedicationRecord
  | HealthKitLabRecord
  | HealthKitConditionRecord
  | HealthKitAllergyRecord
  | HealthKitProcedureRecord
  | HealthKitVitalSignRecord
  | HealthKitImmunizationRecord

export interface RawClinicalRecord {
  id: string
  type: string          // HKClinicalTypeIdentifier raw value
  displayName: string
  startDate: string     // ISO 8601
  fhirData: string | null
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export function normalise(r: RawClinicalRecord): ExtendedHealthKitRecord | null {
  const fhir = parseFhir(r.fhirData)

  switch (r.type) {
    case 'HKClinicalTypeIdentifierMedicationRecord':
      return normaliseMedication(r, fhir)
    case 'HKClinicalTypeIdentifierLabResultRecord':
      return normaliseLabResult(r, fhir)
    case 'HKClinicalTypeIdentifierConditionRecord':
      return normaliseCondition(r, fhir)
    case 'HKClinicalTypeIdentifierAllergyRecord':
      return normaliseAllergy(r, fhir)
    case 'HKClinicalTypeIdentifierProcedureRecord':
      return normaliseProcedure(r, fhir)
    case 'HKClinicalTypeIdentifierVitalSignRecord':
      return normaliseVitalSign(r, fhir)
    case 'HKClinicalTypeIdentifierImmunizationRecord':
      return normaliseImmunization(r, fhir)
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Per-resource normalisers
// ---------------------------------------------------------------------------

export function normaliseMedication(
  r: RawClinicalRecord,
  fhir: Record<string, unknown> | null,
): HealthKitMedicationRecord {
  const dosage = firstPath<Record<string, unknown>[]>(fhir, 'dosageInstruction')?.[0]
  const coding = firstPath<Record<string, unknown>[]>(fhir, 'medicationCodeableConcept', 'coding')?.[0]

  return {
    type: 'medication',
    healthkitFhirId: r.id,
    name: (coding?.display as string) ?? r.displayName,
    dose: (dosage?.text as string) ?? null,
    frequency: stringifyTiming(
      firstPath<Record<string, unknown>>(dosage ?? {}, 'timing'),
    ),
    prescribingDoctor: extractPractitionerName(fhir),
  }
}

export function normaliseLabResult(
  r: RawClinicalRecord,
  fhir: Record<string, unknown> | null,
): HealthKitLabRecord {
  const valueQuantity = firstPath<Record<string, unknown>>(fhir, 'valueQuantity')
  const refRange = firstPath<Record<string, unknown>[]>(fhir, 'referenceRange')?.[0]

  return {
    type: 'labResult',
    healthkitFhirId: r.id,
    testName: r.displayName,
    value: valueQuantity
      ? String(valueQuantity.value ?? '')
      : (firstPath<string>(fhir, 'valueString') ?? ''),
    unit: (valueQuantity?.unit as string) ?? null,
    referenceRange: refRange
      ? `${(refRange.low as { value?: unknown })?.value ?? ''}–${(refRange.high as { value?: unknown })?.value ?? ''}`
      : null,
    dateTaken: isoToDate(r.startDate),
  }
}

export function normaliseCondition(
  r: RawClinicalRecord,
  fhir: Record<string, unknown> | null,
): HealthKitConditionRecord {
  const coding = firstPath<Record<string, unknown>[]>(fhir, 'code', 'coding')?.[0]
  const clinicalStatus =
    firstPath<string>(fhir, 'clinicalStatus', 'text') ??
    (firstPath<Record<string, unknown>[]>(fhir, 'clinicalStatus', 'coding')?.[0]?.code as string | undefined) ??
    null
  return {
    type: 'condition',
    healthkitFhirId: r.id,
    code: (coding?.code as string) ?? null,
    display: (coding?.display as string) ?? r.displayName,
    clinicalStatus,
    onsetDateTime: firstPath<string>(fhir, 'onsetDateTime') ?? r.startDate ?? null,
  }
}

export function normaliseAllergy(
  r: RawClinicalRecord,
  fhir: Record<string, unknown> | null,
): HealthKitAllergyRecord {
  const coding = firstPath<Record<string, unknown>[]>(fhir, 'code', 'coding')?.[0]
  const reactionEntry = firstPath<Record<string, unknown>[]>(fhir, 'reaction')?.[0]
  const manifestation = firstPath<Record<string, unknown>[]>(reactionEntry ?? {}, 'manifestation')?.[0]
  const reactionText =
    (manifestation?.text as string) ??
    (firstPath<Record<string, unknown>[]>(manifestation ?? {}, 'coding')?.[0]?.display as string) ??
    null
  return {
    type: 'allergy',
    healthkitFhirId: r.id,
    code: (coding?.code as string) ?? null,
    display: (coding?.display as string) ?? r.displayName,
    reaction: reactionText,
    criticality: firstPath<string>(fhir, 'criticality') ?? null,
  }
}

export function normaliseProcedure(
  r: RawClinicalRecord,
  fhir: Record<string, unknown> | null,
): HealthKitProcedureRecord {
  const coding = firstPath<Record<string, unknown>[]>(fhir, 'code', 'coding')?.[0]
  const performed =
    firstPath<string>(fhir, 'performedDateTime') ??
    firstPath<string>(fhir, 'performedPeriod', 'start') ??
    r.startDate ??
    null
  return {
    type: 'procedure',
    healthkitFhirId: r.id,
    code: (coding?.code as string) ?? null,
    display: (coding?.display as string) ?? r.displayName,
    performedDateTime: performed,
  }
}

export function normaliseVitalSign(
  r: RawClinicalRecord,
  fhir: Record<string, unknown> | null,
): HealthKitVitalSignRecord {
  const coding = firstPath<Record<string, unknown>[]>(fhir, 'code', 'coding')?.[0]
  const valueQuantity = firstPath<Record<string, unknown>>(fhir, 'valueQuantity')
  return {
    type: 'vitalSign',
    healthkitFhirId: r.id,
    code: (coding?.code as string) ?? null,
    display: (coding?.display as string) ?? r.displayName,
    value: valueQuantity ? String(valueQuantity.value ?? '') : null,
    unit: (valueQuantity?.unit as string) ?? null,
    effectiveDateTime: firstPath<string>(fhir, 'effectiveDateTime') ?? r.startDate ?? null,
  }
}

export function normaliseImmunization(
  r: RawClinicalRecord,
  fhir: Record<string, unknown> | null,
): HealthKitImmunizationRecord {
  const coding = firstPath<Record<string, unknown>[]>(fhir, 'vaccineCode', 'coding')?.[0]
  return {
    type: 'immunization',
    healthkitFhirId: r.id,
    code: (coding?.code as string) ?? null,
    display: (coding?.display as string) ?? r.displayName,
    occurrenceDateTime: firstPath<string>(fhir, 'occurrenceDateTime') ?? r.startDate ?? null,
  }
}

// ---------------------------------------------------------------------------
// FHIR utilities
// ---------------------------------------------------------------------------

export function parseFhir(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Traverse a FHIR object by a sequence of keys. */
export function firstPath<T>(
  obj: Record<string, unknown> | null | undefined,
  ...keys: string[]
): T | null {
  let cursor: unknown = obj
  for (const key of keys) {
    if (cursor == null || typeof cursor !== 'object') return null
    cursor = (cursor as Record<string, unknown>)[key]
  }
  return (cursor as T) ?? null
}

export function extractPractitionerName(fhir: Record<string, unknown> | null): string | null {
  const ref =
    firstPath<Record<string, unknown>>(fhir, 'requester') ??
    firstPath<Record<string, unknown>[]>(fhir, 'performer')?.[0]
  return (ref?.display as string) ?? null
}

export function stringifyTiming(timing: Record<string, unknown> | null): string | null {
  if (!timing) return null
  const code = firstPath<string>(timing, 'code', 'text')
  if (code) return code
  const repeat_ = firstPath<Record<string, unknown>>(timing, 'repeat')
  if (!repeat_) return null
  const freq = repeat_.frequency
  const period = repeat_.period
  const periodUnit = repeat_.periodUnit
  if (freq && period && periodUnit) return `${freq}x per ${period}${periodUnit}`
  return null
}

/** Convert an ISO 8601 timestamp to a YYYY-MM-DD date string. */
export function isoToDate(iso: string): string | null {
  try {
    return new Date(iso).toISOString().split('T')[0] ?? null
  } catch {
    return null
  }
}
