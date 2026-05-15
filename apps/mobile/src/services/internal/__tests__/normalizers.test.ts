import { describe, it, expect } from 'vitest'
import {
  normalise,
  normaliseMedication,
  normaliseLabResult,
  normaliseCondition,
  normaliseAllergy,
  normaliseProcedure,
  normaliseVitalSign,
  normaliseImmunization,
  parseFhir,
  firstPath,
  extractPractitionerName,
  stringifyTiming,
  isoToDate,
  type RawClinicalRecord,
} from '../normalizers'

function raw(type: string, fhir: object | null, overrides: Partial<RawClinicalRecord> = {}): RawClinicalRecord {
  return {
    id: 'rec-1',
    type,
    displayName: 'Display Name',
    startDate: '2026-05-08T08:15:00Z',
    fhirData: fhir ? JSON.stringify(fhir) : null,
    ...overrides,
  }
}

describe('parseFhir', () => {
  it('returns null for null input', () => {
    expect(parseFhir(null)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseFhir('not json {')).toBeNull()
  })

  it('parses valid JSON', () => {
    expect(parseFhir('{"a":1}')).toEqual({ a: 1 })
  })
})

describe('firstPath', () => {
  const fhir = {
    a: { b: { c: 'deep' } },
    arr: [{ x: 1 }, { x: 2 }],
  }

  it('returns the value at a multi-key path', () => {
    expect(firstPath<string>(fhir, 'a', 'b', 'c')).toBe('deep')
  })

  it('returns null for a missing key', () => {
    expect(firstPath(fhir, 'a', 'missing')).toBeNull()
  })

  it('returns null when traversing through a non-object', () => {
    expect(firstPath(fhir, 'a', 'b', 'c', 'd')).toBeNull()
  })

  it('handles null / undefined input', () => {
    expect(firstPath(null, 'x')).toBeNull()
    expect(firstPath(undefined, 'x')).toBeNull()
  })
})

describe('extractPractitionerName', () => {
  it('reads MedicationRequest.requester.display', () => {
    expect(extractPractitionerName({ requester: { display: 'Dr. Sarah Chen' } })).toBe('Dr. Sarah Chen')
  })

  it('falls back to first performer.display', () => {
    expect(extractPractitionerName({ performer: [{ display: 'Dr. Adams' }] })).toBe('Dr. Adams')
  })

  it('returns null when neither field present', () => {
    expect(extractPractitionerName({})).toBeNull()
    expect(extractPractitionerName(null)).toBeNull()
  })
})

describe('stringifyTiming', () => {
  it('returns the timing.code.text when present', () => {
    expect(stringifyTiming({ code: { text: 'BID' } })).toBe('BID')
  })

  it('formats repeat.frequency/period/periodUnit', () => {
    expect(stringifyTiming({ repeat: { frequency: 1, period: 1, periodUnit: 'd' } })).toBe('1x per 1d')
    expect(stringifyTiming({ repeat: { frequency: 1, period: 3, periodUnit: 'wk' } })).toBe('1x per 3wk')
  })

  it('returns null for incomplete repeat fields', () => {
    expect(stringifyTiming({ repeat: { frequency: 1, period: 1 } })).toBeNull()
  })

  it('returns null for null/empty timing', () => {
    expect(stringifyTiming(null)).toBeNull()
    expect(stringifyTiming({})).toBeNull()
  })
})

describe('isoToDate', () => {
  it('extracts YYYY-MM-DD from an ISO timestamp', () => {
    expect(isoToDate('2026-05-08T08:15:00Z')).toBe('2026-05-08')
  })

  it('returns null for an invalid string', () => {
    expect(isoToDate('not a date')).toBeNull()
  })
})

describe('normaliseMedication', () => {
  it('pulls name/dose/frequency/doctor from a full FHIR MedicationRequest', () => {
    const r = raw('HKClinicalTypeIdentifierMedicationRecord', {
      resourceType: 'MedicationRequest',
      medicationCodeableConcept: {
        coding: [{ display: 'Tamoxifen 20 mg', code: '198240' }],
      },
      dosageInstruction: [{
        text: '20 mg once daily',
        timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd' } },
      }],
      requester: { display: 'Dr. Chen' },
    })
    const out = normaliseMedication(r, parseFhir(r.fhirData))
    expect(out).toEqual({
      type: 'medication',
      healthkitFhirId: 'rec-1',
      name: 'Tamoxifen 20 mg',
      dose: '20 mg once daily',
      frequency: '1x per 1d',
      prescribingDoctor: 'Dr. Chen',
    })
  })

  it('falls back to displayName when coding.display is absent', () => {
    const r = raw('HKClinicalTypeIdentifierMedicationRecord', {}, { displayName: 'Aspirin' })
    const out = normaliseMedication(r, parseFhir(r.fhirData))
    expect(out.name).toBe('Aspirin')
    expect(out.dose).toBeNull()
    expect(out.frequency).toBeNull()
    expect(out.prescribingDoctor).toBeNull()
  })
})

describe('normaliseLabResult', () => {
  it('pulls value/unit/referenceRange from valueQuantity', () => {
    const r = raw('HKClinicalTypeIdentifierLabResultRecord', {
      resourceType: 'Observation',
      valueQuantity: { value: 11.2, unit: 'g/dL' },
      referenceRange: [{ low: { value: 12 }, high: { value: 15.5 } }],
    }, { displayName: 'Hemoglobin' })
    const out = normaliseLabResult(r, parseFhir(r.fhirData))
    expect(out).toEqual({
      type: 'labResult',
      healthkitFhirId: 'rec-1',
      testName: 'Hemoglobin',
      value: '11.2',
      unit: 'g/dL',
      referenceRange: '12–15.5',
      dateTaken: '2026-05-08',
    })
  })

  it('uses valueString fallback when valueQuantity missing', () => {
    const r = raw('HKClinicalTypeIdentifierLabResultRecord', { valueString: 'Negative' })
    const out = normaliseLabResult(r, parseFhir(r.fhirData))
    expect(out.value).toBe('Negative')
    expect(out.unit).toBeNull()
    expect(out.referenceRange).toBeNull()
  })
})

describe('normaliseCondition', () => {
  it('extracts code/display/clinicalStatus/onsetDateTime', () => {
    const r = raw('HKClinicalTypeIdentifierConditionRecord', {
      code: { coding: [{ code: 'C50.9', display: 'Breast cancer' }] },
      clinicalStatus: { coding: [{ code: 'active' }] },
      onsetDateTime: '2024-01-15',
    })
    expect(normaliseCondition(r, parseFhir(r.fhirData))).toEqual({
      type: 'condition',
      healthkitFhirId: 'rec-1',
      code: 'C50.9',
      display: 'Breast cancer',
      clinicalStatus: 'active',
      onsetDateTime: '2024-01-15',
    })
  })

  it('falls back to record.startDate when onsetDateTime missing', () => {
    const r = raw('HKClinicalTypeIdentifierConditionRecord', {})
    const out = normaliseCondition(r, parseFhir(r.fhirData))
    expect(out.onsetDateTime).toBe('2026-05-08T08:15:00Z')
    expect(out.clinicalStatus).toBeNull()
  })

  it('reads clinicalStatus.text when no coding present', () => {
    const r = raw('HKClinicalTypeIdentifierConditionRecord', {
      clinicalStatus: { text: 'inactive' },
    })
    expect(normaliseCondition(r, parseFhir(r.fhirData)).clinicalStatus).toBe('inactive')
  })
})

describe('normaliseAllergy', () => {
  it('extracts code/display/reaction/criticality', () => {
    const r = raw('HKClinicalTypeIdentifierAllergyRecord', {
      code: { coding: [{ code: '7980', display: 'Penicillin' }] },
      reaction: [{ manifestation: [{ text: 'Hives' }] }],
      criticality: 'high',
    })
    expect(normaliseAllergy(r, parseFhir(r.fhirData))).toEqual({
      type: 'allergy',
      healthkitFhirId: 'rec-1',
      code: '7980',
      display: 'Penicillin',
      reaction: 'Hives',
      criticality: 'high',
    })
  })

  it('reads manifestation.coding[0].display when text absent', () => {
    const r = raw('HKClinicalTypeIdentifierAllergyRecord', {
      reaction: [{ manifestation: [{ coding: [{ display: 'Anaphylaxis' }] }] }],
    })
    expect(normaliseAllergy(r, parseFhir(r.fhirData)).reaction).toBe('Anaphylaxis')
  })

  it('null fields when reaction array empty', () => {
    const r = raw('HKClinicalTypeIdentifierAllergyRecord', {})
    const out = normaliseAllergy(r, parseFhir(r.fhirData))
    expect(out.reaction).toBeNull()
    expect(out.criticality).toBeNull()
  })
})

describe('normaliseProcedure', () => {
  it('uses performedDateTime when present', () => {
    const r = raw('HKClinicalTypeIdentifierProcedureRecord', {
      code: { coding: [{ code: '80146002', display: 'Appendectomy' }] },
      performedDateTime: '2023-06-12',
    })
    expect(normaliseProcedure(r, parseFhir(r.fhirData))).toEqual({
      type: 'procedure',
      healthkitFhirId: 'rec-1',
      code: '80146002',
      display: 'Appendectomy',
      performedDateTime: '2023-06-12',
    })
  })

  it('falls back to performedPeriod.start', () => {
    const r = raw('HKClinicalTypeIdentifierProcedureRecord', {
      performedPeriod: { start: '2023-06-12T10:00:00Z' },
    })
    expect(normaliseProcedure(r, parseFhir(r.fhirData)).performedDateTime).toBe('2023-06-12T10:00:00Z')
  })

  it('falls back to record.startDate when no period fields', () => {
    const r = raw('HKClinicalTypeIdentifierProcedureRecord', {})
    expect(normaliseProcedure(r, parseFhir(r.fhirData)).performedDateTime).toBe('2026-05-08T08:15:00Z')
  })
})

describe('normaliseVitalSign', () => {
  it('extracts code/display/value/unit/effectiveDateTime', () => {
    const r = raw('HKClinicalTypeIdentifierVitalSignRecord', {
      code: { coding: [{ code: '8480-6', display: 'Systolic BP' }] },
      valueQuantity: { value: 120, unit: 'mmHg' },
      effectiveDateTime: '2026-05-08T08:00:00Z',
    })
    expect(normaliseVitalSign(r, parseFhir(r.fhirData))).toEqual({
      type: 'vitalSign',
      healthkitFhirId: 'rec-1',
      code: '8480-6',
      display: 'Systolic BP',
      value: '120',
      unit: 'mmHg',
      effectiveDateTime: '2026-05-08T08:00:00Z',
    })
  })

  it('null value when no valueQuantity', () => {
    const r = raw('HKClinicalTypeIdentifierVitalSignRecord', {})
    const out = normaliseVitalSign(r, parseFhir(r.fhirData))
    expect(out.value).toBeNull()
    expect(out.unit).toBeNull()
  })
})

describe('normaliseImmunization', () => {
  it('uses vaccineCode.coding and occurrenceDateTime', () => {
    const r = raw('HKClinicalTypeIdentifierImmunizationRecord', {
      vaccineCode: { coding: [{ code: '208', display: 'COVID-19 mRNA' }] },
      occurrenceDateTime: '2023-09-15',
    })
    expect(normaliseImmunization(r, parseFhir(r.fhirData))).toEqual({
      type: 'immunization',
      healthkitFhirId: 'rec-1',
      code: '208',
      display: 'COVID-19 mRNA',
      occurrenceDateTime: '2023-09-15',
    })
  })

  it('falls back to record.startDate when occurrence missing', () => {
    const r = raw('HKClinicalTypeIdentifierImmunizationRecord', {})
    expect(normaliseImmunization(r, parseFhir(r.fhirData)).occurrenceDateTime).toBe('2026-05-08T08:15:00Z')
  })
})

describe('normalise (dispatcher)', () => {
  it('returns null for unknown HK type', () => {
    expect(normalise(raw('HKClinicalTypeIdentifierUnknown', {}))).toBeNull()
  })

  it('routes each known type to its normaliser', () => {
    const cases = [
      ['HKClinicalTypeIdentifierMedicationRecord', 'medication'],
      ['HKClinicalTypeIdentifierLabResultRecord', 'labResult'],
      ['HKClinicalTypeIdentifierConditionRecord', 'condition'],
      ['HKClinicalTypeIdentifierAllergyRecord', 'allergy'],
      ['HKClinicalTypeIdentifierProcedureRecord', 'procedure'],
      ['HKClinicalTypeIdentifierVitalSignRecord', 'vitalSign'],
      ['HKClinicalTypeIdentifierImmunizationRecord', 'immunization'],
    ] as const
    for (const [hkType, expectedDiscriminator] of cases) {
      const out = normalise(raw(hkType, {}))
      expect(out?.type).toBe(expectedDiscriminator)
    }
  })

  it('handles null fhirData (parseFhir returns null) without crashing', () => {
    const r = raw('HKClinicalTypeIdentifierMedicationRecord', null)
    expect(normalise(r)?.type).toBe('medication')
  })
})
