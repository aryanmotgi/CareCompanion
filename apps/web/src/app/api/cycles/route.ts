import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess, ApiErrors } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { treatmentCycles, careProfiles } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const PostSchema = z.object({
  profile_id: z.string().uuid('Valid profile ID is required'),
  cycle_number: z.number().int().min(1, 'Cycle number must be at least 1'),
  start_date: z.string().min(1, 'Start date is required'),
  cycle_length_days: z.number().int().min(1).default(21),
  regimen_name: z.string().optional(),
  notes: z.string().optional(),
});

// GET — list all treatment cycles for a care profile
export async function GET(req: Request) {
  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');

    if (!profileId) {
      return apiError('profileId query parameter is required', 400);
    }

    // Verify the profile belongs to this user
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(and(eq(careProfiles.id, profileId), eq(careProfiles.userId, dbUser!.id)))
      .limit(1);

    if (!profile) {
      return apiError('Care profile not found', 404);
    }

    const cycles = await db
      .select()
      .from(treatmentCycles)
      .where(eq(treatmentCycles.careProfileId, profileId))
      .orderBy(desc(treatmentCycles.cycleNumber));

    return apiSuccess({ cycles });
  } catch (err) {
    console.error('[cycles] GET error:', err);
    return apiError('Internal server error', 500);
  }
}

// POST — create a new treatment cycle
export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) {
    return ApiErrors.rateLimited();
  }

  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(PostSchema, body);
    if (valError) return valError;

    // Verify the profile belongs to this user
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(and(eq(careProfiles.id, validated.profile_id), eq(careProfiles.userId, dbUser!.id)))
      .limit(1);

    if (!profile) {
      return apiError('Care profile not found', 404);
    }

    // Deactivate any currently active cycles for this profile
    await db
      .update(treatmentCycles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(treatmentCycles.careProfileId, validated.profile_id), eq(treatmentCycles.isActive, true)));

    // Create the new cycle
    const [cycle] = await db
      .insert(treatmentCycles)
      .values({
        careProfileId: validated.profile_id,
        cycleNumber: validated.cycle_number,
        startDate: validated.start_date,
        cycleLengthDays: validated.cycle_length_days,
        regimenName: validated.regimen_name || null,
        notes: validated.notes || null,
        isActive: true,
      })
      .returning();

    return apiSuccess({ cycle }, 201);
  } catch (err) {
    console.error('[cycles] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
