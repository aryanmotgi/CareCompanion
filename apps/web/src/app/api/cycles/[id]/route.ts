import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess, ApiErrors } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { treatmentCycles, careProfiles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const PatchSchema = z.object({
  cycle_number: z.number().int().min(1).optional(),
  start_date: z.string().optional(),
  cycle_length_days: z.number().int().min(1).optional(),
  regimen_name: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

interface Props { params: Promise<{ id: string }> }

// DELETE — remove a treatment cycle
export async function DELETE(req: Request, { params }: Props) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const ip = req.headers.get('x-real-ip')?.trim() ?? req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ?? 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) return ApiErrors.rateLimited();

  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id } = await params;

    const [existingCycle] = await db
      .select({ id: treatmentCycles.id, careProfileId: treatmentCycles.careProfileId })
      .from(treatmentCycles)
      .where(eq(treatmentCycles.id, id))
      .limit(1);

    if (!existingCycle) return apiError('Treatment cycle not found', 404);

    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(and(eq(careProfiles.id, existingCycle.careProfileId), eq(careProfiles.userId, dbUser!.id)))
      .limit(1);

    if (!profile) return apiError('Treatment cycle not found', 404);

    await db.delete(treatmentCycles).where(eq(treatmentCycles.id, id));

    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error('[cycles/id] DELETE error:', err);
    return apiError('Internal server error', 500);
  }
}

// PATCH — update a treatment cycle
export async function PATCH(req: Request, { params }: Props) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const ip = req.headers.get('x-real-ip')?.trim() ?? req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ?? 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) {
    return ApiErrors.rateLimited();
  }

  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id } = await params;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(PatchSchema, body);
    if (valError) return valError;

    // Fetch the cycle and verify ownership through the care profile
    const [existingCycle] = await db
      .select({
        id: treatmentCycles.id,
        careProfileId: treatmentCycles.careProfileId,
      })
      .from(treatmentCycles)
      .where(eq(treatmentCycles.id, id))
      .limit(1);

    if (!existingCycle) {
      return apiError('Treatment cycle not found', 404);
    }

    // Verify the care profile belongs to this user
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(and(eq(careProfiles.id, existingCycle.careProfileId), eq(careProfiles.userId, dbUser!.id)))
      .limit(1);

    if (!profile) {
      return apiError('Treatment cycle not found', 404);
    }

    // If activating this cycle, deactivate others for the same profile
    if (validated.is_active === true) {
      await db
        .update(treatmentCycles)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(treatmentCycles.careProfileId, existingCycle.careProfileId), eq(treatmentCycles.isActive, true)));
    }

    // Build the update payload
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (validated.cycle_number !== undefined) updateData.cycleNumber = validated.cycle_number;
    if (validated.start_date !== undefined) updateData.startDate = validated.start_date;
    if (validated.cycle_length_days !== undefined) updateData.cycleLengthDays = validated.cycle_length_days;
    if (validated.regimen_name !== undefined) updateData.regimenName = validated.regimen_name;
    if (validated.notes !== undefined) updateData.notes = validated.notes;
    if (validated.is_active !== undefined) updateData.isActive = validated.is_active;

    const [updated] = await db
      .update(treatmentCycles)
      .set(updateData)
      .where(eq(treatmentCycles.id, id))
      .returning();

    return apiSuccess({ cycle: updated });
  } catch (err) {
    console.error('[cycles/id] PATCH error:', err);
    return apiError('Internal server error', 500);
  }
}
