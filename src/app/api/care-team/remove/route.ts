import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess, ApiErrors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { careTeamMembers, careTeamActivity } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { rateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const RemoveSchema = z.object({
  member_id: z.string().uuid('Valid member_id is required'),
});

// POST — remove a member from the care team or leave the team
export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) {
    return ApiErrors.rateLimited();
  }

  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(RemoveSchema, body);
    if (valError) return valError;

    const { member_id } = validated;

    // Get the target member
    const [target] = await db
      .select()
      .from(careTeamMembers)
      .where(eq(careTeamMembers.id, member_id))
      .limit(1);

    if (!target) {
      return apiError('Member not found', 404);
    }

    // Can't remove the owner
    if (target.role === 'owner') {
      return apiError('Cannot remove the profile owner', 403);
    }

    // Check permission: either removing yourself, or you're the owner
    const isSelf = target.userId === dbUser!.id;
    if (!isSelf) {
      const [myMembership] = await db
        .select({ role: careTeamMembers.role })
        .from(careTeamMembers)
        .where(
          and(
            eq(careTeamMembers.careProfileId, target.careProfileId),
            eq(careTeamMembers.userId, dbUser!.id)
          )
        )
        .limit(1);

      if (!myMembership || myMembership.role !== 'owner') {
        return apiError('Only the owner can remove other team members', 403);
      }
    }

    // Remove the member
    await db.delete(careTeamMembers).where(eq(careTeamMembers.id, member_id));

    // Log activity
    const displayName = dbUser!.displayName || dbUser!.email?.split('@')[0] || 'Someone';
    const action = isSelf ? 'left the care team' : 'removed a team member';
    await db.insert(careTeamActivity).values({
      careProfileId: target.careProfileId,
      userId: dbUser!.id,
      userName: displayName,
      action,
    });

    return apiSuccess({ success: true });
  } catch (err) {
    console.error('[care-team/remove] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
