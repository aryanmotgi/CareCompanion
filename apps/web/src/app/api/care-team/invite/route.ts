import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess, ApiErrors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { careTeamMembers, careTeamInvites, careTeamActivity, careProfiles, users } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { sendEmail, careTeamInviteEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const InviteSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['editor', 'viewer']).default('viewer'),
});

// POST — invite someone to the care team by email
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
    const { data: validated, error: valError } = validateBody(InviteSchema, body);
    if (valError) return valError;

    const { email, role } = validated;

    // Check the user is an owner or editor
    const [membership] = await db
      .select({ careProfileId: careTeamMembers.careProfileId, role: careTeamMembers.role })
      .from(careTeamMembers)
      .where(
        and(
          eq(careTeamMembers.userId, dbUser!.id),
          inArray(careTeamMembers.role, ['owner', 'editor'])
        )
      )
      .limit(1);

    if (!membership) {
      return apiError('You do not have permission to invite team members', 403);
    }

    // Can't invite yourself
    if (email.toLowerCase() === dbUser!.email?.toLowerCase()) {
      return apiError('You cannot invite yourself', 400);
    }

    // Check for existing pending invite
    const [existing] = await db
      .select({ id: careTeamInvites.id })
      .from(careTeamInvites)
      .where(
        and(
          eq(careTeamInvites.careProfileId, membership.careProfileId),
          eq(careTeamInvites.invitedEmail, email.toLowerCase()),
          eq(careTeamInvites.status, 'pending')
        )
      )
      .limit(1);

    if (existing) {
      return apiError('An invitation has already been sent to this email', 400);
    }

    // Check if they're already a team member (look up by email in users table)
    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (targetUser) {
      const [alreadyMember] = await db
        .select({ id: careTeamMembers.id })
        .from(careTeamMembers)
        .where(
          and(
            eq(careTeamMembers.careProfileId, membership.careProfileId),
            eq(careTeamMembers.userId, targetUser.id)
          )
        )
        .limit(1);

      if (alreadyMember) {
        return apiError('This person is already on the care team', 400);
      }
    }

    // Create the invite
    const [invite] = await db
      .insert(careTeamInvites)
      .values({
        careProfileId: membership.careProfileId,
        invitedEmail: email.toLowerCase(),
        role,
        invitedBy: dbUser!.id,
      })
      .returning({ id: careTeamInvites.id });

    if (!invite) {
      return apiError('Failed to create invitation', 500);
    }

    // Log activity
    const displayName = dbUser!.displayName || dbUser!.email?.split('@')[0] || 'Someone';
    await db.insert(careTeamActivity).values({
      careProfileId: membership.careProfileId,
      userId: dbUser!.id,
      userName: displayName,
      action: `invited ${email} as ${role}`,
    });

    // Send invite email
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'http://localhost:3000');

    const [profile] = await db
      .select({ patientName: careProfiles.patientName })
      .from(careProfiles)
      .where(eq(careProfiles.id, membership.careProfileId))
      .limit(1);

    const acceptUrl = `${baseUrl}/care-team?accept=${invite.id}`;
    const patientName = profile?.patientName || 'a patient';

    const html = careTeamInviteEmail({
      inviterName: displayName,
      patientName,
      role,
      acceptUrl,
    });

    const emailResult = await sendEmail({
      to: email.toLowerCase(),
      subject: `${displayName} invited you to a care team on CareCompanion`,
      html,
    });

    if (!emailResult.success) {
      console.warn('[care-team/invite] Email send skipped/failed:', emailResult.reason);
    }

    return apiSuccess({ success: true, message: `Invitation sent to ${email}` });
  } catch (err) {
    console.error('[care-team/invite] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
