import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { careProfiles, careTeamMembers, userPreferences } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { rateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const SwitchSchema = z.object({
  profile_id: z.string().uuid('Valid profile_id is required'),
});

// POST — switch active care profile
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) {
    return apiError('Too many requests', 429);
  }

  try {
    const { valid, error: csrfError } = await validateCsrf(req);
    if (!valid) return csrfError!;

    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    await logAudit({
      user_id: user!.id,
      action: 'switch_profile',
      ip_address: req.headers.get('x-forwarded-for') || undefined,
    });

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(SwitchSchema, body);
    if (valError) return valError;

    const { profile_id } = validated;

    const [profile] = await db
      .select({ id: careProfiles.id, patientName: careProfiles.patientName })
      .from(careProfiles)
      .where(eq(careProfiles.id, profile_id))
      .limit(1);

    if (!profile) return apiError('Profile not found', 404);

    // Check ownership or care team membership
    const [ownerRow] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(and(eq(careProfiles.id, profile_id), eq(careProfiles.userId, user!.id)))
      .limit(1);

    const [teamRow] = await db
      .select({ id: careTeamMembers.id })
      .from(careTeamMembers)
      .where(and(eq(careTeamMembers.careProfileId, profile_id), eq(careTeamMembers.userId, user!.id)))
      .limit(1);

    if (!ownerRow && !teamRow) {
      return apiError('You do not have access to this profile', 403);
    }

    await db.insert(userPreferences).values({
      userId: user!.id,
      activeProfileId: profile_id,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: userPreferences.userId,
      set: { activeProfileId: profile_id, updatedAt: new Date() },
    });

    return apiSuccess({ success: true, message: `Switched to ${profile.patientName}'s profile.` });
  } catch (err) {
    console.error('[profile-switch] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
