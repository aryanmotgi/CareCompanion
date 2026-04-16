import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { careProfiles, medications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const MAX_MEDICATIONS_PER_IMPORT = 50;

const MedicationItemSchema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  dose: z.string().optional(),
  frequency: z.string().optional(),
});

const ImportSchema = z.object({
  medications: z.array(MedicationItemSchema)
    .min(1, 'At least one medication is required')
    .max(MAX_MEDICATIONS_PER_IMPORT, `Max ${MAX_MEDICATIONS_PER_IMPORT} medications per import`),
  source: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    // Rate limit: 20 imports per minute
    const rateCheck = checkRateLimit(`import-meds:${user!.id}`, { maxRequests: 20, windowMs: 60_000 });
    if (!rateCheck.allowed) {
      return Response.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.retryAfterMs / 1000)) } }
      );
    }

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(ImportSchema, body);
    if (valError) return valError;

    const { medications: meds, source } = validated;

    // Get care profile
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, user!.id))
      .limit(1);

    if (!profile) {
      return apiError('No care profile found', 400);
    }

    // Insert all medications
    const rows = meds.map((med) => ({
      careProfileId: profile.id,
      name: med.name,
      dose: med.dose ?? null,
      frequency: med.frequency ?? null,
      notes: source ? `Imported from ${source}` : null,
    }));

    await db.insert(medications).values(rows);

    return apiSuccess({ success: true, count: rows.length });
  } catch (err) {
    console.error('[import-medications] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
