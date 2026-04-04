import { z } from 'zod'

/**
 * Zod schema for document extraction output.
 * Single source of truth for what the Claude Vision API returns.
 */
export const ExtractionSchema = z.object({
  document_type: z.enum([
    'lab_report',
    'medication',
    'insurance_card',
    'eob_bill',
    'doctor_note',
  ]),
  confidence: z.number().min(0).max(1),
  extracted_data: z.object({
    // Lab report fields
    lab_results: z.array(z.object({
      test_name: z.string(),
      value: z.string(),
      unit: z.string().optional(),
      reference_range: z.string().optional(),
      is_abnormal: z.boolean().optional(),
      date_taken: z.string().optional(),
    })).optional(),

    // Medication fields
    medications: z.array(z.object({
      name: z.string(),
      dose: z.string().optional(),
      frequency: z.string().optional(),
      prescribing_doctor: z.string().optional(),
      refill_date: z.string().optional(),
      pharmacy_phone: z.string().optional(),
    })).optional(),

    // Insurance fields
    insurance: z.object({
      provider: z.string().optional(),
      member_id: z.string().optional(),
      group_number: z.string().optional(),
      plan_type: z.string().optional(),
    }).optional(),

    // EOB/Bill fields
    claim: z.object({
      provider_name: z.string().optional(),
      service_date: z.string().optional(),
      billed_amount: z.number().optional(),
      paid_amount: z.number().optional(),
      patient_responsibility: z.number().optional(),
      denial_reason: z.string().optional(),
    }).optional(),

    // Appointments (from doctor notes, referrals, discharge papers)
    appointments: z.array(z.object({
      doctor_name: z.string().optional(),
      date_time: z.string().optional(),
      purpose: z.string().optional(),
      location: z.string().optional(),
    })).optional(),

    // Diagnoses / conditions (from doctor notes, lab reports, discharge summaries)
    conditions: z.array(z.string()).optional(),

    // Doctor note summary
    summary: z.string().optional(),
    follow_up_notes: z.string().optional(),
    doctor_name: z.string().optional(),
  }),
})

export type Extraction = z.infer<typeof ExtractionSchema>
