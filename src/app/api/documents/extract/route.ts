import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { type Extraction } from '@/lib/extraction-schema'
import { extractDocument } from '@/lib/extract-document'

export const maxDuration = 60

const RATE_LIMIT_CONFIG = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 10 requests per minute per user
}

const MAX_BASE64_LENGTH = 13_500_000 // ~10 MB decoded

/**
 * POST /api/documents/extract
 *
 * Unified document extraction API. Accepts either:
 *   - FormData with `file` (image file) and optional `category` hint
 *   - JSON with `image_base64` (base64-encoded image)
 *
 * Returns structured, Zod-validated extraction results.
 * Optionally auto-imports extracted data into the care profile.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Rate limiting
    const rateCheck = checkRateLimit(`extract:${user.id}`, RATE_LIMIT_CONFIG)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before scanning another document.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rateCheck.retryAfterMs / 1000)) },
        }
      )
    }

    // Parse input: support both FormData and JSON
    const { image_base64, auto_import, document_id, category } = await parseRequest(req)

    if (!image_base64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    if (image_base64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({ error: 'Image too large (max 10 MB)' }, { status: 413 })
    }

    // Extract structured data using Claude Vision
    const extraction = await extractDocument(image_base64, category)

    // Auto-import if requested and confidence is sufficient
    // Use higher threshold (0.85) for safety-critical data like medications and labs
    const confidenceThreshold = (extraction.document_type === 'medication' || extraction.document_type === 'lab_report')
      ? 0.85
      : 0.7

    if (auto_import && extraction.confidence >= confidenceThreshold) {
      const admin = createAdminClient()
      const { data: profile } = await supabase
        .from('care_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        const imported = await autoImportExtraction(admin, user.id, profile.id, extraction)

        // Update document record if document_id provided (with ownership check)
        if (document_id) {
          await admin.from('documents').update({
            type: extraction.document_type,
            description: getDocumentDescription(extraction),
          }).eq('id', document_id).eq('care_profile_id', profile.id)
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

// --- Request parsing ---

interface ParsedRequest {
  image_base64: string | null
  auto_import: boolean
  document_id: string | null
  category: string | null
}

async function parseRequest(req: Request): Promise<ParsedRequest> {
  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    // FormData upload (from DocumentScanner, CategoryScanner, CvsImportModal)
    const formData = await req.formData()
    const file = (formData.get('file') || formData.get('image')) as File | null
    const category = formData.get('category') as string | null
    const autoImport = formData.get('auto_import') === 'true'

    if (!file) return { image_base64: null, auto_import: false, document_id: null, category }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    return {
      image_base64: base64,
      auto_import: autoImport,
      document_id: null,
      category,
    }
  }

  // JSON body (programmatic usage)
  const body = await req.json()
  return {
    image_base64: body.image_base64 || null,
    auto_import: body.auto_import || false,
    document_id: body.document_id || null,
    category: body.category || null,
  }
}

// --- Auto-import logic ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoImportExtraction(admin: any, userId: string, profileId: string, extraction: Extraction) {
  const counts = { lab_results: 0, medications: 0, insurance: 0, claims: 0, appointments: 0, conditions: 0 }
  const data = extraction.extracted_data

  // Import lab results (with duplicate detection by test_name + date)
  if (data.lab_results?.length) {
    const { data: existingLabs } = await admin
      .from('lab_results')
      .select('test_name, date_taken')
      .eq('user_id', userId)

    const existingKeys = new Set(
      (existingLabs || []).map((l: { test_name: string; date_taken: string | null }) =>
        `${l.test_name.toLowerCase()}|${l.date_taken || ''}`
      )
    )

    const today = new Date().toISOString().split('T')[0]
    const newLabs = data.lab_results
      .filter((lab) => {
        const key = `${lab.test_name.toLowerCase()}|${lab.date_taken || today}`
        return !existingKeys.has(key)
      })
      .map((lab) => ({
        user_id: userId,
        test_name: lab.test_name,
        value: lab.value,
        unit: lab.unit || null,
        reference_range: lab.reference_range || null,
        is_abnormal: lab.is_abnormal ?? false,
        date_taken: lab.date_taken || today,
        source: 'document_scan',
      }))

    if (newLabs.length > 0) {
      const { error } = await admin.from('lab_results').insert(newLabs)
      if (!error) counts.lab_results = newLabs.length
    }
  }

  // Import medications (with duplicate detection by name)
  if (data.medications?.length) {
    const { data: existingMeds } = await admin
      .from('medications')
      .select('name')
      .eq('care_profile_id', profileId)

    const existingNames = new Set(
      (existingMeds || []).map((m: { name: string }) => m.name.toLowerCase())
    )

    const newMeds = data.medications
      .filter((med) => !existingNames.has(med.name.toLowerCase()))
      .map((med) => ({
        care_profile_id: profileId,
        name: med.name,
        dose: med.dose || null,
        frequency: med.frequency || null,
        prescribing_doctor: med.prescribing_doctor || null,
        refill_date: med.refill_date || null,
        pharmacy_phone: med.pharmacy_phone || null,
      }))

    if (newMeds.length > 0) {
      const { error } = await admin.from('medications').insert(newMeds)
      if (!error) counts.medications = newMeds.length
    }
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

  // Import appointments
  if (data.appointments?.length) {
    const appts = data.appointments.map((appt) => ({
      care_profile_id: profileId,
      doctor_name: appt.doctor_name || null,
      date_time: appt.date_time || null,
      purpose: appt.purpose || null,
    }))
    const { error } = await admin.from('appointments').insert(appts)
    if (!error) counts.appointments = appts.length
  }

  // Import conditions (append to care profile)
  if (data.conditions?.length) {
    const { data: profile } = await admin
      .from('care_profiles')
      .select('conditions')
      .eq('id', profileId)
      .single()

    const existing = profile?.conditions || ''
    const newConditions = data.conditions.filter(
      (c: string) => !existing.toLowerCase().includes(c.toLowerCase())
    )

    if (newConditions.length > 0) {
      const updated = existing
        ? `${existing}\n${newConditions.join('\n')}`
        : newConditions.join('\n')
      await admin.from('care_profiles').update({ conditions: updated }).eq('id', profileId)
      counts.conditions = newConditions.length
    }
  }

  return counts
}

function getDocumentDescription(extraction: Extraction): string {
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
