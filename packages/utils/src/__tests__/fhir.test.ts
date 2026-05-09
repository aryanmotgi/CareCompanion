import { describe, it, expect } from 'vitest'
import { fhirMedicationToMedication, fhirObservationToLabResult, fhirEncounterToAppointment } from '../fhir'

describe('fhirMedicationToMedication', () => {
  it('converts a FHIR MedicationRequest', () => {
    const fhir = {
      id: 'fhir-med-123',
      resourceType: 'MedicationRequest',
      medicationCodeableConcept: { text: 'Methotrexate 2.5mg' },
      dosageInstruction: [{ text: 'Once weekly' }],
      requester: { display: 'Dr. Smith' },
    }
    const result = fhirMedicationToMedication(fhir)
    expect(result.type).toBe('medication')
    expect(result.name).toBe('Methotrexate 2.5mg')
    expect(result.frequency).toBe('Once weekly')
    expect(result.prescribingDoctor).toBe('Dr. Smith')
    expect(result.healthkitFhirId).toBe('fhir-med-123')
    // Server adds careProfileId — converter does NOT
    expect(result).not.toHaveProperty('careProfileId')
  })

  it('handles missing optional fields', () => {
    const fhir = { id: 'fhir-med-456', resourceType: 'MedicationRequest', medicationCodeableConcept: { text: 'Aspirin' } }
    const result = fhirMedicationToMedication(fhir)
    expect(result.name).toBe('Aspirin')
    expect(result.frequency).toBeNull()
    expect(result.prescribingDoctor).toBeNull()
  })
})

describe('fhirObservationToLabResult', () => {
  it('converts a FHIR Observation — output matches labResults schema (userId + dateTaken)', () => {
    const fhir = {
      id: 'fhir-obs-123',
      resourceType: 'Observation',
      code: { text: 'Hemoglobin' },
      valueQuantity: { value: 12.5, unit: 'g/dL' },
      referenceRange: [{ text: '12.0–16.0 g/dL' }],
      effectiveDateTime: '2026-04-01T10:00:00Z',
    }
    const result = fhirObservationToLabResult(fhir)
    expect(result.type).toBe('labResult')
    expect(result.testName).toBe('Hemoglobin')
    expect(result.value).toBe('12.5')
    expect(result.unit).toBe('g/dL')
    expect(result.referenceRange).toBe('12.0–16.0 g/dL')
    expect(result.dateTaken).toBe('2026-04-01')
    expect(result.healthkitFhirId).toBe('fhir-obs-123')
    expect(result).not.toHaveProperty('userId')
  })
})

describe('fhirEncounterToAppointment', () => {
  it('converts a FHIR Encounter — output uses dateTime (timestamp) not date string', () => {
    const fhir = {
      id: 'fhir-enc-123',
      resourceType: 'Encounter',
      participant: [{ individual: { display: 'Dr. Jones' } }],
      period: { start: '2026-05-01T09:00:00Z' },
      location: [{ location: { display: 'Cancer Center' } }],
    }
    const result = fhirEncounterToAppointment(fhir)
    expect(result.type).toBe('appointment')
    expect(result.doctorName).toBe('Dr. Jones')
    expect(result.dateTime).toBe('2026-05-01T09:00:00Z')
    expect(result.location).toBe('Cancer Center')
    expect(result.healthkitFhirId).toBe('fhir-enc-123')
    expect(result).not.toHaveProperty('careProfileId')
  })
})
