import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST — remove a member from the care team or leave the team
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { member_id } = await req.json();

  if (!member_id) {
    return Response.json({ error: 'member_id is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get the target member
  const { data: target } = await admin
    .from('care_team_members')
    .select('*')
    .eq('id', member_id)
    .single();

  if (!target) {
    return Response.json({ error: 'Member not found' }, { status: 404 });
  }

  // Can't remove the owner
  if (target.role === 'owner') {
    return Response.json({ error: 'Cannot remove the profile owner' }, { status: 403 });
  }

  // Check permission: either removing yourself, or you're the owner
  const isSelf = target.user_id === user.id;
  if (!isSelf) {
    const { data: myRole } = await admin
      .from('care_team_members')
      .select('role')
      .eq('care_profile_id', target.care_profile_id)
      .eq('user_id', user.id)
      .single();

    if (!myRole || myRole.role !== 'owner') {
      return Response.json({ error: 'Only the owner can remove other team members' }, { status: 403 });
    }
  }

  // Remove the member
  const { error } = await admin.from('care_team_members').delete().eq('id', member_id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Someone';
  const action = isSelf ? 'left the care team' : `removed a team member`;
  await admin.from('care_team_activity').insert({
    care_profile_id: target.care_profile_id,
    user_id: user.id,
    user_name: displayName,
    action,
  });

  return Response.json({ success: true });
}
