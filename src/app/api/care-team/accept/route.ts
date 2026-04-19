import { getAuthenticatedUser, parseBody } from '@/lib/api-helpers';
import { ApiErrors } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { careTeamInvites, careTeamMembers, careTeamActivity } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

// POST — accept a care team invitation
export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) {
    return ApiErrors.rateLimited();
  }

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error || !dbUser) return new Response('Unauthorized', { status: 401 });

  const { body, error: bodyError } = await parseBody<{ invite_id?: string }>(req);
  if (bodyError) return bodyError;
  const { invite_id } = body;

  if (!invite_id) {
    return Response.json({ error: 'invite_id is required' }, { status: 400 });
  }

  // Get the invite
  const [invite] = await db
    .select()
    .from(careTeamInvites)
    .where(and(eq(careTeamInvites.id, invite_id), eq(careTeamInvites.status, 'pending')))
    .limit(1);

  if (!invite) {
    return Response.json({ error: 'Invitation not found or already used' }, { status: 404 });
  }

  // Verify the invite is for this user
  if (invite.invitedEmail.toLowerCase() !== dbUser.email?.toLowerCase()) {
    return Response.json({ error: 'This invitation is not for your account' }, { status: 403 });
  }

  // Check if expired
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return Response.json({ error: 'This invitation has expired' }, { status: 410 });
  }

  // Add user to the care team
  try {
    await db.insert(careTeamMembers).values({
      careProfileId: invite.careProfileId,
      userId: dbUser.id,
      role: invite.role,
      invitedBy: invite.invitedBy,
    });
  } catch (err) {
    console.error('[care-team/accept] insert error:', err);
    return Response.json({ error: 'Failed to join care team' }, { status: 500 });
  }

  // Mark invite as accepted
  await db.update(careTeamInvites)
    .set({ status: 'accepted' })
    .where(eq(careTeamInvites.id, invite_id));

  // Log activity
  const displayName = dbUser.displayName || dbUser.email?.split('@')[0] || 'Someone';
  await db.insert(careTeamActivity).values({
    careProfileId: invite.careProfileId,
    userId: dbUser.id,
    userName: displayName,
    action: `joined the care team as ${invite.role}`,
  });

  return Response.json({ success: true, message: 'You have joined the care team!' });
}
