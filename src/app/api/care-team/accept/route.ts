import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

// POST — accept a care team invitation
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { invite_id } = await req.json();

  if (!invite_id) {
    return Response.json({ error: 'invite_id is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get the invite
  const { data: invite } = await admin
    .from('care_team_invites')
    .select('*')
    .eq('id', invite_id)
    .eq('status', 'pending')
    .single();

  if (!invite) {
    return Response.json({ error: 'Invitation not found or already used' }, { status: 404 });
  }

  // Verify the invite is for this user
  if (invite.invited_email.toLowerCase() !== user.email?.toLowerCase()) {
    return Response.json({ error: 'This invitation is not for your account' }, { status: 403 });
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    return Response.json({ error: 'This invitation has expired' }, { status: 410 });
  }

  // Add user to the care team
  const { error: memberError } = await admin.from('care_team_members').insert({
    care_profile_id: invite.care_profile_id,
    user_id: user.id,
    role: invite.role,
    invited_by: invite.invited_by,
  });

  if (memberError) {
    return Response.json({ error: memberError.message }, { status: 500 });
  }

  // Mark invite as accepted
  await admin.from('care_team_invites')
    .update({ status: 'accepted' })
    .eq('id', invite_id);

  // Log activity
  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Someone';
  await admin.from('care_team_activity').insert({
    care_profile_id: invite.care_profile_id,
    user_id: user.id,
    user_name: displayName,
    action: `joined the care team as ${invite.role}`,
  });

  return Response.json({ success: true, message: 'You have joined the care team!' });
}
