import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { careProfiles, labResults, medications, insurance, claims, appointments, documents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { type Extraction } from '@/lib/extraction-schema'
import { extractDocument } from '@/lib/extract-document'

export const maxDuration = 60

const RATE_LIMIT_CONFIG = {
  maxRequests: 10,
  windowMs: 60 * 1000,
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
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    // Rate limiting
    const rateCheck = checkRateLimit(`extract:${dbUser!.id}`, RATE_LIMIT_CONFIG)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before scanning another document.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rateCheck.retryAfterMs / 1000)) },
        }
      )
    }

    const { image_base64, auto_import, document_id, category } = await parseRequest(req)

    if (!image_base64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    if (image_base64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({ error: 'Image too large (max 10 MB)' }, { status: 413 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI extraction is not configured' }, { status: 503 })
    }

    const extraction = await extractDocument(image_base64, category)

    const confidenceThreshold = (extraction.document_type === 'medication' || extraction.document_type === 'lab_report')
      ? 0.85
      : 0.7

    if (auto_import && extraction.confidence >= confidenceThreshold) {
      const [profile] = await db
        .select({ id: careProfiles.id })
        .from(careProfiles)
        .where(eq(careProfiles.userId, dbUser!.id))
        .limit(1)

      if (profile) {
        const imported = await autoImportExtraction(dbUser!.id, profile.id, extraction)

        if (document_id) {
          await db.update(documents).set({
            type: extraction.document_type,
            description: getDocumentDescription(extraction),
          }).where(eq(documents.id, document_id))
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

  const body = await req.json()
  return {
    image_base64: body.image_base64 || null,
    auto_import: body.auto_import || false,
    document_id: body.document_id || null,
    category: body.category || null,
  }
}

// --- Auto-import logic ---

async function autoImportExtraction(userId: string, profileId: string, extraction: Extraction) {
  const counts = { lab_results: 0, medications: 0, insurance: 0, claims: 0, appointments: 0, conditions: 0 }
  const data = extraction.extracted_data
  const today = new Date().toISOString().split('T')[0]

  // Import lab results (with duplicate detection by test_name + date)
  if (data.lab_results?.length) {
    const existingLabs = await db
      .select({ testName: labResults.testName, dateTaken: labResults.dateTaken })
      .from(labResults)
      .where(eq(labResults.userId, userId))

    const existingKeys = new Set(
      existingLabs.map((l) => `${l.testName.toLowerCase()}|${l.dateTaken || ''}`)
    )

    const newLabs = data.lab_results
      .filter((lab) => {
        const key = `${lab.test_name.toLowerCase()}|${lab.date_taken || today}`
        return !existingKeys.has(key)
      })
      .map((lab) => ({
        userId,
        testName: lab.test_name,
        value: lab.value,
        unit: lab.unit || null,
        referenceRange: lab.reference_range || null,
        isAbnormal: lab.is_abnormal ?? false,
        dateTaken: lab.date_taken || today,
        source: 'document_scan',
      }))

    if (newLabs.length > 0) {
      await db.insert(labResults).values(newLabs)
      counts.lab_results = newLabs.length
    }
  }

  // Import medications (with duplicate detection by name)
  if (data.medications?.length) {
    const existingMeds = await db
      .select({ name: medications.name })
      .from(medications)
      .where(eq(medications.careProfileId, profileId))

    const existingNames = new Set(existingMeds.map((m) => m.name.toLowerCase()))

    const newMeds = data.medications
      .filter((med) => !existingNames.has(med.name.toLowerCase()))
      .map((med) => ({
        careProfileId: profileId,
        name: med.name,
        dose: med.dose || null,
        frequency: med.frequency || null,
        prescribingDoctor: med.prescribing_doctor || null,
        refillDate: med.refill_date || null,
        pharmacyPhone: med.pharmacy_phone || null,
      }))

    if (newMeds.length > 0) {
      await db.insert(medications).values(newMeds)
      counts.medications = newMeds.length
    }
  }

  // Import insurance
  if (data.insurance?.provider) {
    await db.insert(insurance).values({
      userId,
      provider: data.insurance.provider,
      memberId: data.insurance.member_id || null,
      groupNumber: data.insurance.group_number || null,
    }).onConflictDoUpdate({
      target: insurance.userId,
      set: {
        provider: data.insurance.provider,
        memberId: data.insurance.member_id || null,
        groupNumber: data.insurance.group_number || null,
      },
    })
    counts.insurance = 1
  }

  // Import claim
  if (data.claim?.provider_name) {
    await db.insert(claims).values({
      userId,
      providerName: data.claim.provider_name,
      serviceDate: data.claim.service_date || null,
      billedAmount: String(data.claim.billed_amount || 0),
      paidAmount: String(data.claim.paid_amount || 0),
      patientResponsibility: String(data.claim.patient_responsibility || 0),
      denialReason: data.claim.denial_reason || null,
      status: data.claim.denial_reason ? 'denied' : 'processed',
    })
    counts.claims = 1
  }

  // Import appointments
  if (data.appointments?.length) {
    const existingAppts = await db
      .select({ doctorName: appointments.doctorName, dateTime: appointments.dateTime })
      .from(appointments)
      .where(eq(appointments.careProfileId, profileId))

    const existingApptKeys = new Set(
      existingAppts.map((a) => `${(a.doctorName || '').toLowerCase()}|${a.dateTime?.toISOString() || ''}`)
    )

    const newAppts = data.appointments
      .filter((appt) => {
        const key = `${(appt.doctor_name || '').toLowerCase()}|${appt.date_time || ''}`
        return !existingApptKeys.has(key)
      })
      .map((appt) => ({
        careProfileId: profileId,
        doctorName: appt.doctor_name || null,
        dateTime: appt.date_time ? new Date(appt.date_time) : null,
        purpose: appt.purpose || null,
      }))

    if (newAppts.length > 0) {
      await db.insert(appointments).values(newAppts)
      counts.appointments = newAppts.length
    }
  }

  // Import conditions
  if (data.conditions?.length) {
    const [profile] = await db
      .select({ conditions: careProfiles.conditions })
      .from(careProfiles)
      .where(eq(careProfiles.id, profileId))
      .limit(1)

    const existing = profile?.conditions || ''
    const newConditions = data.conditions.filter(
      (c: string) => !existing.toLowerCase().includes(c.toLowerCase())
    )

    if (newConditions.length > 0) {
      const updated = existing
        ? `${existing}\n${newConditions.join('\n')}`
        : newConditions.join('\n')
      await db.update(careProfiles).set({ conditions: updated }).where(eq(careProfiles.id, profileId))
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
