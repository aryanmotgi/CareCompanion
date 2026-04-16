import { getAuthenticatedUser } from '@/lib/api-helpers'
import { extractDocument } from '@/lib/extract-document'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 30

/**
 * POST /api/extract-medications
 *
 * Legacy endpoint — kept for backward compatibility with CvsImportModal.
 * Uses the unified extraction engine with a medication category hint.
 *
 * Accepts FormData with `image` (file).
 * Returns { medications: [...] } in the legacy format.
 */
export async function POST(req: Request) {
  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    const rateCheck = checkRateLimit(`extract:${dbUser!.id}`, { maxRequests: 10, windowMs: 60_000 })
    if (!rateCheck.allowed) {
      return Response.json(
        { error: 'Too many requests.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.retryAfterMs / 1000)) } }
      )
    }

    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null
    if (!imageFile) {
      return Response.json({ error: 'No image provided' }, { status: 400 })
    }

    const bytes = await imageFile.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const extraction = await extractDocument(base64, 'medication')

    return Response.json({
      medications: extraction.extracted_data.medications || [],
    })
  } catch {
    return Response.json({ medications: [] })
  }
}
