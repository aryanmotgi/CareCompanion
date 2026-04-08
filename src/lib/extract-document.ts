import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { ExtractionSchema, type Extraction } from '@/lib/extraction-schema'

/**
 * Core document extraction logic.
 * Takes a base64 image and optional category hint, returns Zod-validated structured data.
 */
const VALID_CATEGORIES = ['lab_report', 'medication', 'insurance', 'eob', 'doctor_note']

export async function extractDocument(
  image_base64: string,
  category?: string | null
): Promise<Extraction> {
  // Validate category against allowlist to prevent prompt injection
  const safeCategory = category && VALID_CATEGORIES.includes(category) ? category : null
  const prompt = buildExtractionPrompt(safeCategory)

  const { object: extraction } = await generateObject({
    model: anthropic('claude-sonnet-4-6'),
    schema: ExtractionSchema,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: image_base64 },
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  return extraction
}

function buildExtractionPrompt(category: string | null): string {
  const categoryHint = category
    ? `\nHint: The user indicated this is a "${category}" document. Prioritize extracting ${category}-specific fields, but still extract any other data you find.`
    : ''

  return `Analyze this medical document image and extract all structured data.

Identify the document type:
- lab_report: Contains test names, values, reference ranges
- medication: Prescription label, pill bottle, or medication list
- insurance_card: Insurance card with member ID, group number
- eob_bill: Explanation of Benefits or medical bill
- doctor_note: Clinical notes, discharge summary, visit notes, referral letters

Extract every piece of data you can identify:

For lab results: test names, values, units, reference ranges, flag abnormal values, collection dates.
For medications: drug name (brand/generic), dosage, frequency/directions, prescribing doctor, refill dates, pharmacy phone.
For insurance: provider, member ID, group number, plan type.
For bills/EOB: provider, service date, amounts (billed, paid, patient responsibility), denial reasons.
For appointments: doctor name, date/time, purpose, location (from follow-up instructions, referrals, or scheduling notes).
For conditions/diagnoses: list all diagnoses, conditions, or ICD codes mentioned.
For doctor notes: summary, follow-up instructions, doctor name.

Be thorough and accurate. If you can't read a field clearly, omit it rather than guessing.${categoryHint}`
}
