import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { db } from '@/lib/db';
import { treatmentCycles, careProfiles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET — get the current active treatment cycle with computed day number
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

    // Fetch the active cycle for this profile
    const [activeCycle] = await db
      .select()
      .from(treatmentCycles)
      .where(and(eq(treatmentCycles.careProfileId, profileId), eq(treatmentCycles.isActive, true)))
      .limit(1);

    if (!activeCycle) {
      return apiSuccess({ cycle: null });
    }

    // Compute day of cycle and days remaining
    const startDate = new Date(activeCycle.startDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const dayOfCycle = diffDays + 1; // Day 1 is the start date
    const daysRemaining = Math.max(0, activeCycle.cycleLengthDays - dayOfCycle);

    return apiSuccess({
      cycle: {
        id: activeCycle.id,
        cycleNumber: activeCycle.cycleNumber,
        dayOfCycle,
        regimenName: activeCycle.regimenName,
        startDate: activeCycle.startDate,
        cycleLengthDays: activeCycle.cycleLengthDays,
        daysRemaining,
        notes: activeCycle.notes,
        isActive: activeCycle.isActive,
        createdAt: activeCycle.createdAt,
        updatedAt: activeCycle.updatedAt,
      },
    });
  } catch (err) {
    console.error('[cycles/current] GET error:', err);
    return apiError('Internal server error', 500);
  }
}
