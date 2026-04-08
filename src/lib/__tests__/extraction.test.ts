import { describe, it, expect } from 'vitest'
import { ExtractionSchema } from '@/lib/extraction-schema'

describe('ExtractionSchema', () => {
  it('validates a complete lab report extraction', () => {
    const data = {
      document_type: 'lab_report',
      confidence: 0.95,
      extracted_data: {
        lab_results: [
          {
            test_name: 'LDL Cholesterol',
            value: '145',
            unit: 'mg/dL',
            reference_range: '<100',
            is_abnormal: true,
            date_taken: '2026-03-15',
          },
          {
            test_name: 'HDL Cholesterol',
            value: '55',
            unit: 'mg/dL',
            reference_range: '>40',
            is_abnormal: false,
          },
        ],
        conditions: ['Hyperlipidemia'],
        doctor_name: 'Dr. Chen',
        summary: 'Lipid panel results from routine screening',
      },
    }

    const result = ExtractionSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.extracted_data.lab_results).toHaveLength(2)
      expect(result.data.extracted_data.lab_results![0].is_abnormal).toBe(true)
      expect(result.data.extracted_data.conditions).toEqual(['Hyperlipidemia'])
    }
  })

  it('validates a medication extraction', () => {
    const data = {
      document_type: 'medication',
      confidence: 0.88,
      extracted_data: {
        medications: [
          {
            name: 'Lisinopril',
            dose: '10mg',
            frequency: 'Once daily',
            prescribing_doctor: 'Dr. Smith',
            refill_date: '2026-04-15',
            pharmacy_phone: '555-0100',
          },
        ],
      },
    }

    const result = ExtractionSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.extracted_data.medications).toHaveLength(1)
      expect(result.data.extracted_data.medications![0].name).toBe('Lisinopril')
    }
  })

  it('validates a doctor note with appointments and conditions', () => {
    const data = {
      document_type: 'doctor_note',
      confidence: 0.82,
      extracted_data: {
        appointments: [
          {
            doctor_name: 'Dr. Patel',
            date_time: '2026-04-20T14:00:00',
            purpose: 'Follow-up for blood pressure',
            location: 'Suite 200, Medical Plaza',
          },
        ],
        conditions: ['Hypertension', 'Type 2 Diabetes'],
        medications: [
          { name: 'Metformin', dose: '500mg', frequency: 'Twice daily' },
        ],
        summary: 'Annual check-up, blood pressure controlled, continue current meds',
        follow_up_notes: 'Return in 3 months for A1C check',
        doctor_name: 'Dr. Johnson',
      },
    }

    const result = ExtractionSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.extracted_data.appointments).toHaveLength(1)
      expect(result.data.extracted_data.conditions).toHaveLength(2)
      expect(result.data.extracted_data.appointments![0].location).toBe('Suite 200, Medical Plaza')
    }
  })

  it('validates an insurance card extraction', () => {
    const data = {
      document_type: 'insurance_card',
      confidence: 0.91,
      extracted_data: {
        insurance: {
          provider: 'Blue Cross Blue Shield',
          member_id: 'XYZ123456789',
          group_number: 'G-44021',
          plan_type: 'PPO',
        },
      },
    }

    const result = ExtractionSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.extracted_data.insurance!.provider).toBe('Blue Cross Blue Shield')
    }
  })

  it('validates an EOB/bill extraction', () => {
    const data = {
      document_type: 'eob_bill',
      confidence: 0.85,
      extracted_data: {
        claim: {
          provider_name: 'City Hospital',
          service_date: '2026-02-28',
          billed_amount: 1200.50,
          paid_amount: 950.00,
          patient_responsibility: 250.50,
          denial_reason: undefined,
        },
      },
    }

    const result = ExtractionSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.extracted_data.claim!.billed_amount).toBe(1200.50)
      expect(result.data.extracted_data.claim!.patient_responsibility).toBe(250.50)
    }
  })

  it('rejects invalid document types', () => {
    const data = {
      document_type: 'invalid_type',
      confidence: 0.9,
      extracted_data: {},
    }

    const result = ExtractionSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects confidence out of range', () => {
    const result1 = ExtractionSchema.safeParse({
      document_type: 'lab_report',
      confidence: 1.5,
      extracted_data: {},
    })
    expect(result1.success).toBe(false)

    const result2 = ExtractionSchema.safeParse({
      document_type: 'lab_report',
      confidence: -0.1,
      extracted_data: {},
    })
    expect(result2.success).toBe(false)
  })

  it('allows minimal extraction with just document type and confidence', () => {
    const data = {
      document_type: 'doctor_note',
      confidence: 0.5,
      extracted_data: {
        summary: 'Unreadable document, minimal data extracted',
      },
    }

    const result = ExtractionSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates extraction with all fields populated', () => {
    const data = {
      document_type: 'doctor_note',
      confidence: 0.92,
      extracted_data: {
        lab_results: [{ test_name: 'A1C', value: '6.8', unit: '%', is_abnormal: true }],
        medications: [{ name: 'Metformin', dose: '500mg', frequency: 'Twice daily' }],
        insurance: { provider: 'Aetna', member_id: 'M123' },
        claim: { provider_name: 'Dr. Lee', billed_amount: 200 },
        appointments: [{ doctor_name: 'Dr. Lee', date_time: '2026-05-01', purpose: 'Follow-up' }],
        conditions: ['Type 2 Diabetes', 'Obesity'],
        summary: 'Comprehensive visit',
        follow_up_notes: 'Schedule endocrinology referral',
        doctor_name: 'Dr. Lee',
      },
    }

    const result = ExtractionSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.extracted_data.lab_results).toHaveLength(1)
      expect(result.data.extracted_data.medications).toHaveLength(1)
      expect(result.data.extracted_data.appointments).toHaveLength(1)
      expect(result.data.extracted_data.conditions).toHaveLength(2)
    }
  })
})
