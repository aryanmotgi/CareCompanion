import { createClient } from '@/lib/supabase/server'
import { extractDocument } from '@/lib/extract-document'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

/**
 * POST /api/scan-document
 *
 * Legacy endpoint — kept for backward compatibility with DocumentScanner and CategoryScanner.
 * Uses the unified extraction engine under the hood.
 *
 * Accepts FormData with `file` and optional `category`.
 * Returns the legacy response shape (flat arrays, uppercase doc types).
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Rate limiting (shared with /api/documents/extract)
    const rateCheck = checkRateLimit(`extract:${user.id}`, { maxRequests: 10, windowMs: 60_000 })
    if (!rateCheck.allowed) {
      return Response.json(
        { error: 'Too many requests. Please wait before scanning another document.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.retryAfterMs / 1000)) } }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const category = formData.get('category') as string | null

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Reject oversized files (~10 MB decoded)
    const MAX_BASE64_LENGTH = 13_500_000
    if (base64.length > MAX_BASE64_LENGTH) {
      return Response.json({ error: 'Image too large (max 10 MB)' }, { status: 413 })
    }

    // Use the unified extraction engine
    const extraction = await extractDocument(base64, category)
    const data = extraction.extracted_data

    // Transform to legacy response format
    return Response.json({
      document_type: mapDocType(extraction.document_type),
      summary: data.summary || getDescription(extraction),
      medications: data.medications || [],
      lab_results: data.lab_results || [],
      insurance: data.insurance || null,
      conditions: data.conditions || [],
      appointments: data.appointments || [],
      claims: data.claim ? [{
        service_date: data.claim.service_date,
        provider_name: data.claim.provider_name,
        billed_amount: data.claim.billed_amount,
        paid_amount: data.claim.paid_amount,
        patient_responsibility: data.claim.patient_responsibility,
        status: data.claim.denial_reason ? 'denied' : 'processed',
      }] : [],
      notes: data.follow_up_notes || '',
      date_taken: data.lab_results?.[0]?.date_taken || null,
    })
  } catch {
    return Response.json({
      document_type: 'OTHER',
      summary: 'Failed to analyze document',
      medications: [],
      lab_results: [],
      insurance: null,
      conditions: [],
      appointments: [],
      claims: [],
      notes: '',
    })
  }
}

function mapDocType(type: string): string {
  const map: Record<string, string> = {
    lab_report: 'LAB_REPORT',
    medication: 'PRESCRIPTION',
    insurance_card: 'INSURANCE_CARD',
    eob_bill: 'EOB',
    doctor_note: 'DOCTOR_NOTE',
  }
  return map[type] || 'OTHER'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDescription(extraction: any): string {
  const data = extraction.extracted_data
  switch (extraction.document_type) {
    case 'lab_report': return `Lab Report — ${data.lab_results?.length || 0} results`
    case 'medication': return `Prescription — ${data.medications?.map((m: { name: string }) => m.name).join(', ') || 'unknown'}`
    case 'insurance_card': return `Insurance Card — ${data.insurance?.provider || 'unknown'}`
    case 'eob_bill': return `EOB/Bill — ${data.claim?.provider_name || 'unknown'}`
    case 'doctor_note': return `Doctor Note — ${data.doctor_name || 'unknown'}`
    default: return 'Medical Document'
  }
}
