import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, careTeamInviteEmail } from '@/lib/email';

// POST — invite someone to the care team by email
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { email, role = 'viewer' } = await req.json();

  if (!email || typeof email !== 'string') {
    return Response.json({ error: 'Email is required' }, { status: 400 });
  }

  if (!['editor', 'viewer'].includes(role)) {
    return Response.json({ error: 'Role must be editor or viewer' }, { status: 400 });
  }

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
    return Response.json({ error: 'You do not have permission to invite team members' }, { status: 403 });
  }

  // Can't invite yourself
  if (email.toLowerCase() === user.email?.toLowerCase()) {
    return Response.json({ error: 'You cannot invite yourself' }, { status: 400 });
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
    return Response.json({ error: 'An invitation has already been sent to this email' }, { status: 400 });
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
      return Response.json({ error: 'This person is already on the care team' }, { status: 400 });
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
    return Response.json({ error: error.message }, { status: 500 });
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

  return Response.json({ success: true, message: `Invitation sent to ${email}` });
}
