import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const maxDuration = 60

const ExtractionSchema = z.object({
  document_type: z.enum(['lab_report', 'medication', 'insurance_card', 'eob_bill', 'doctor_note']),
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
    // Doctor note summary
    summary: z.string().optional(),
    follow_up_notes: z.string().optional(),
    doctor_name: z.string().optional(),
  }),
})

/**
 * POST /api/documents/extract
 * Accepts a document image (base64) and uses Claude Vision to extract structured data.
 * Optionally auto-imports extracted data into the appropriate tables.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { image_base64, media_type, auto_import, document_id } = await req.json()

    if (!image_base64) {
      return NextResponse.json({ error: 'image_base64 is required' }, { status: 400 })
    }

    // Use Claude Vision to extract structured data from the document
    const { object: extraction } = await generateObject({
      model: anthropic('claude-sonnet-4-6'),
      schema: ExtractionSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: image_base64,
              mimeType: media_type || 'image/jpeg',
            },
            {
              type: 'text',
              text: `Analyze this medical document image and extract all structured data.

Identify the document type:
- lab_report: Contains test names, values, reference ranges
- medication: Prescription label or medication list
- insurance_card: Insurance card with member ID, group number
- eob_bill: Explanation of Benefits or medical bill
- doctor_note: Clinical notes, discharge summary, visit notes

Extract every piece of data you can identify. For lab results, determine if values are abnormal relative to the reference range. For medications, extract the full prescription details. For insurance, get all identifiers. For bills, get all amounts.

Be thorough and accurate. If you can't read a field clearly, omit it rather than guessing.`,
            },
          ],
        },
      ],
    })

    // Auto-import if requested
    if (auto_import && extraction.confidence >= 0.7) {
      const admin = createAdminClient()
      const { data: profile } = await supabase
        .from('care_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        const imported = await autoImportExtraction(admin, user.id, profile.id, extraction)

        // Update document record if document_id provided
        if (document_id) {
          await admin.from('documents').update({
            type: extraction.document_type,
            description: getDocumentDescription(extraction),
          }).eq('id', document_id)
        }

        return NextResponse.json({
          extraction,
          auto_imported: true,
          imported_counts: imported,
        })
      }
    }

    return NextResponse.json({ extraction, auto_imported: false })
  } catch (error) {
    console.error('[documents/extract] Error:', error)
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoImportExtraction(admin: any, userId: string, profileId: string, extraction: z.infer<typeof ExtractionSchema>) {
  const counts = { lab_results: 0, medications: 0, insurance: 0, claims: 0 }
  const data = extraction.extracted_data

  // Import lab results
  if (data.lab_results?.length) {
    const labs = data.lab_results.map((lab) => ({
      user_id: userId,
      test_name: lab.test_name,
      value: lab.value,
      unit: lab.unit || null,
      reference_range: lab.reference_range || null,
      is_abnormal: lab.is_abnormal ?? false,
      date_taken: lab.date_taken || new Date().toISOString().split('T')[0],
      source: 'document_scan',
    }))
    const { error } = await admin.from('lab_results').insert(labs)
    if (!error) counts.lab_results = labs.length
  }

  // Import medications
  if (data.medications?.length) {
    const meds = data.medications.map((med) => ({
      care_profile_id: profileId,
      name: med.name,
      dose: med.dose || null,
      frequency: med.frequency || null,
      prescribing_doctor: med.prescribing_doctor || null,
      refill_date: med.refill_date || null,
      pharmacy_phone: med.pharmacy_phone || null,
    }))
    const { error } = await admin.from('medications').insert(meds)
    if (!error) counts.medications = meds.length
  }

  // Import insurance
  if (data.insurance?.provider) {
    const { error } = await admin.from('insurance').upsert({
      user_id: userId,
      provider: data.insurance.provider,
      member_id: data.insurance.member_id || null,
      group_number: data.insurance.group_number || null,
      plan_type: data.insurance.plan_type || null,
    }, { onConflict: 'user_id' })
    if (!error) counts.insurance = 1
  }

  // Import claim
  if (data.claim?.provider_name) {
    const { error } = await admin.from('claims').insert({
      user_id: userId,
      provider_name: data.claim.provider_name,
      service_date: data.claim.service_date || null,
      billed_amount: data.claim.billed_amount || 0,
      paid_amount: data.claim.paid_amount || 0,
      patient_responsibility: data.claim.patient_responsibility || 0,
      denial_reason: data.claim.denial_reason || null,
      status: data.claim.denial_reason ? 'denied' : 'processed',
    })
    if (!error) counts.claims = 1
  }

  return counts
}

function getDocumentDescription(extraction: z.infer<typeof ExtractionSchema>): string {
  const data = extraction.extracted_data
  switch (extraction.document_type) {
    case 'lab_report':
      return `Lab Report — ${data.lab_results?.length || 0} results`
    case 'medication':
      return `Prescription — ${data.medications?.map(m => m.name).join(', ') || 'unknown'}`
    case 'insurance_card':
      return `Insurance Card — ${data.insurance?.provider || 'unknown provider'}`
    case 'eob_bill':
      return `EOB/Bill — ${data.claim?.provider_name || 'unknown'}`
    case 'doctor_note':
      return `Doctor Note — ${data.doctor_name || 'unknown'}`
    default:
      return 'Medical Document'
  }
}
