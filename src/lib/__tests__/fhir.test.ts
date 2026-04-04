import { describe, it, expect } from 'vitest'
import {
  parseMedications,
  parseConditions,
  parseAllergies,
  parseAppointments,
  parseLabResults,
  parseClaims,
  parseCoverage,
  type FhirBundle,
} from '@/lib/fhir'

describe('FHIR parsing', () => {
  describe('parseMedications', () => {
    it('returns empty array for empty bundle', () => {
      const bundle: FhirBundle = { resourceType: 'Bundle' }
      expect(parseMedications(bundle)).toEqual([])
    })

    it('parses medication with text name', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'MedicationRequest',
            medicationCodeableConcept: { text: 'Lisinopril' },
            dosageInstruction: [{
              timing: { code: { text: 'Once daily' } },
              doseAndRate: [{ doseQuantity: { value: 10, unit: 'mg' } }],
            }],
          },
        }],
      }
      const result = parseMedications(bundle)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Lisinopril')
      expect(result[0].dose).toBe('10 mg')
      expect(result[0].frequency).toBe('Once daily')
    })

    it('falls back to coding display if no text', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'MedicationRequest',
            medicationCodeableConcept: {
              coding: [{ display: 'Metformin HCl' }],
            },
          },
        }],
      }
      const result = parseMedications(bundle)
      expect(result[0].name).toBe('Metformin HCl')
      expect(result[0].dose).toBeNull()
      expect(result[0].frequency).toBeNull()
    })

    it('ignores non-MedicationRequest resources', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [
          { resource: { resourceType: 'Condition', code: { text: 'Diabetes' } } },
          { resource: { resourceType: 'MedicationRequest', medicationCodeableConcept: { text: 'Insulin' } } },
        ],
      }
      expect(parseMedications(bundle)).toHaveLength(1)
    })
  })

  describe('parseConditions', () => {
    it('returns empty array for empty bundle', () => {
      expect(parseConditions({ resourceType: 'Bundle' })).toEqual([])
    })

    it('parses conditions from text and coding', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [
          { resource: { resourceType: 'Condition', code: { text: 'Type 2 Diabetes' } } },
          { resource: { resourceType: 'Condition', code: { coding: [{ display: 'Hypertension' }] } } },
        ],
      }
      const result = parseConditions(bundle)
      expect(result).toEqual(['Type 2 Diabetes', 'Hypertension'])
    })
  })

  describe('parseAllergies', () => {
    it('parses allergy entries', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [
          { resource: { resourceType: 'AllergyIntolerance', code: { text: 'Penicillin' } } },
          { resource: { resourceType: 'AllergyIntolerance', code: { coding: [{ display: 'Sulfa drugs' }] } } },
        ],
      }
      expect(parseAllergies(bundle)).toEqual(['Penicillin', 'Sulfa drugs'])
    })
  })

  describe('parseAppointments', () => {
    it('parses appointment with participants', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'Appointment',
            start: '2026-05-01T14:00:00Z',
            description: 'Annual physical',
            participant: [{ actor: { display: 'Dr. Chen' } }],
          },
        }],
      }
      const result = parseAppointments(bundle)
      expect(result).toHaveLength(1)
      expect(result[0].doctor_name).toBe('Dr. Chen')
      expect(result[0].date_time).toBe('2026-05-01T14:00:00Z')
      expect(result[0].purpose).toBe('Annual physical')
    })

    it('handles appointment with no participants', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'Appointment',
            start: '2026-05-01T14:00:00Z',
            serviceType: [{ text: 'Lab work' }],
          },
        }],
      }
      const result = parseAppointments(bundle)
      expect(result[0].doctor_name).toBeNull()
      expect(result[0].purpose).toBe('Lab work')
    })
  })

  describe('parseLabResults', () => {
    it('filters to laboratory category only', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              resourceType: 'Observation',
              category: [{ coding: [{ code: 'laboratory' }] }],
              code: { text: 'LDL Cholesterol' },
              valueQuantity: { value: 145, unit: 'mg/dL' },
              referenceRange: [{ low: { value: 0 }, high: { value: 100 } }],
              interpretation: [{ coding: [{ code: 'H' }] }],
              effectiveDateTime: '2026-03-15T10:00:00Z',
            },
          },
          {
            resource: {
              resourceType: 'Observation',
              category: [{ coding: [{ code: 'vital-signs' }] }],
              code: { text: 'Blood Pressure' },
              valueQuantity: { value: 120, unit: 'mmHg' },
            },
          },
        ],
      }
      const result = parseLabResults(bundle)
      expect(result).toHaveLength(1) // Only the lab, not vital signs
      expect(result[0].test_name).toBe('LDL Cholesterol')
      expect(result[0].value).toBe('145')
      expect(result[0].unit).toBe('mg/dL')
      expect(result[0].reference_range).toBe('0-100')
      expect(result[0].is_abnormal).toBe(true)
      expect(result[0].date_taken).toBe('2026-03-15')
    })

    it('handles Low interpretation code', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'Observation',
            category: [{ coding: [{ code: 'laboratory' }] }],
            code: { text: 'Hemoglobin' },
            valueQuantity: { value: 10, unit: 'g/dL' },
            interpretation: [{ coding: [{ code: 'L' }] }],
          },
        }],
      }
      expect(parseLabResults(bundle)[0].is_abnormal).toBe(true)
    })

    it('marks normal results as not abnormal', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'Observation',
            category: [{ coding: [{ code: 'laboratory' }] }],
            code: { text: 'Glucose' },
            valueQuantity: { value: 95, unit: 'mg/dL' },
            interpretation: [{ coding: [{ code: 'N' }] }],
          },
        }],
      }
      expect(parseLabResults(bundle)[0].is_abnormal).toBe(false)
    })
  })

  describe('parseClaims', () => {
    it('parses ExplanationOfBenefit with totals', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'ExplanationOfBenefit',
            billablePeriod: { start: '2026-02-15T00:00:00Z' },
            provider: { display: 'City Hospital' },
            outcome: 'complete',
            total: [
              { category: { coding: [{ code: 'submitted' }] }, amount: { value: 1200 } },
              { category: { coding: [{ code: 'benefit' }] }, amount: { value: 900 } },
              { category: { coding: [{ code: 'deductible' }] }, amount: { value: 300 } },
            ],
          },
        }],
      }
      const result = parseClaims(bundle)
      expect(result).toHaveLength(1)
      expect(result[0].provider_name).toBe('City Hospital')
      expect(result[0].billed_amount).toBe(1200)
      expect(result[0].paid_amount).toBe(900)
      expect(result[0].patient_responsibility).toBe(300)
      expect(result[0].status).toBe('paid')
      expect(result[0].service_date).toBe('2026-02-15')
    })

    it('marks denied claims', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'ExplanationOfBenefit',
            outcome: 'error',
            provider: { display: 'Lab Corp' },
            total: [],
          },
        }],
      }
      const result = parseClaims(bundle)
      expect(result[0].status).toBe('denied')
      expect(result[0].denial_reason).toBe('Claim denied by insurer')
    })
  })

  describe('parseCoverage', () => {
    it('parses coverage with payor and class info', () => {
      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'Coverage',
            payor: [{ display: 'Blue Cross' }],
            subscriberId: 'XYZ789',
            class: [
              { type: { coding: [{ code: 'group' }] }, value: 'G-100' },
            ],
          },
        }],
      }
      const result = parseCoverage(bundle)
      expect(result).toHaveLength(1)
      expect(result[0].provider).toBe('Blue Cross')
      expect(result[0].member_id).toBe('XYZ789')
      expect(result[0].group_number).toBe('G-100')
    })
  })
})
