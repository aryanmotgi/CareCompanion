import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, careTeamInviteEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { NextResponse } from 'next/server';
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
  const { success } = limiter.check(ip);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(InviteSchema, body);
    if (valError) return valError;

    const { email, role } = validated;
    const admin = createAdminClient();

    // Check the user is an owner or editor
    const { data: membership } = await admin
      .from('care_team_members')
      .select('care_profile_id, role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'editor'])
      .limit(1)
      .single();

    if (!membership) {
      return apiError('You do not have permission to invite team members', 403);
    }

    // Can't invite yourself
    if (email.toLowerCase() === user.email?.toLowerCase()) {
      return apiError('You cannot invite yourself', 400);
    }

    // Check for existing pending invite
    const { data: existing } = await admin
      .from('care_team_invites')
      .select('id')
      .eq('care_profile_id', membership.care_profile_id)
      .eq('invited_email', email.toLowerCase())
      .eq('status', 'pending')
      .limit(1)
      .single();

    if (existing) {
      return apiError('An invitation has already been sent to this email', 400);
    }

    // Check if they're already a team member
    const { data: invitedUser } = await admin.auth.admin.listUsers();
    const targetUser = invitedUser?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (targetUser) {
      const { data: alreadyMember } = await admin
        .from('care_team_members')
        .select('id')
        .eq('care_profile_id', membership.care_profile_id)
        .eq('user_id', targetUser.id)
        .limit(1)
        .single();

      if (alreadyMember) {
        return apiError('This person is already on the care team', 400);
      }
    }

    // Create the invite
    const { data: invite, error } = await admin.from('care_team_invites').insert({
      care_profile_id: membership.care_profile_id,
      invited_email: email.toLowerCase(),
      role,
      invited_by: user.id,
    }).select('id').single();

    if (error) {
      return apiError(error.message, 500);
    }

    // Log activity
    const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Someone';
    await admin.from('care_team_activity').insert({
      care_profile_id: membership.care_profile_id,
      user_id: user.id,
      user_name: displayName,
      action: `invited ${email} as ${role}`,
    });

    // Send invite email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'http://localhost:3000');

    const { data: profile } = await admin
      .from('care_profiles')
      .select('patient_name')
      .eq('id', membership.care_profile_id)
      .single();

    const acceptUrl = `${baseUrl}/care-team?accept=${invite.id}`;
    const patientName = profile?.patient_name || 'a patient';

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
