import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { db } from '@/lib/db';
import { careTeamInvites, careTeamMembers, careTeamActivity } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { validateCsrf } from '@/lib/csrf';

// DELETE — revoke a pending care team invite
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id: inviteId } = await params;

    // Find the invite
    const [invite] = await db
      .select({
        id: careTeamInvites.id,
        careProfileId: careTeamInvites.careProfileId,
        invitedEmail: careTeamInvites.invitedEmail,
        status: careTeamInvites.status,
      })
      .from(careTeamInvites)
      .where(eq(careTeamInvites.id, inviteId))
      .limit(1);

    if (!invite) {
      return apiError('Invite not found', 404);
    }

    if (invite.status !== 'pending') {
      return apiError('Only pending invites can be revoked', 400);
    }

    // Verify caller is owner or editor on this care profile
    const [membership] = await db
      .select({ role: careTeamMembers.role })
      .from(careTeamMembers)
      .where(
        and(
          eq(careTeamMembers.userId, dbUser!.id),
          eq(careTeamMembers.careProfileId, invite.careProfileId),
          inArray(careTeamMembers.role, ['owner', 'editor'])
        )
      )
      .limit(1);

    if (!membership) {
      return apiError('You do not have permission to revoke this invite', 403);
    }

    // Revoke
    await db
      .update(careTeamInvites)
      .set({ status: 'revoked' })
      .where(
        and(
          eq(careTeamInvites.id, inviteId),
          eq(careTeamInvites.status, 'pending')
        )
      );

    // Log activity
    const displayName = dbUser!.displayName || dbUser!.email?.split('@')[0] || 'Someone';
    await db.insert(careTeamActivity).values({
      careProfileId: invite.careProfileId,
      userId: dbUser!.id,
      userName: displayName,
      action: `revoked invite for ${invite.invitedEmail}`,
    });

    return apiSuccess({ success: true });
  } catch (err) {
    console.error('[care-team/invite/[id]] DELETE error:', err);
    return apiError('Internal server error', 500);
  }
}
