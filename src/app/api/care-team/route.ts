import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET — list team members and pending invites for the user's care profile
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const admin = createAdminClient();

  // Get the user's care profile (as owner or team member)
  const { data: membership } = await admin
    .from('care_team_members')
    .select('care_profile_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) {
    return Response.json({ members: [], invites: [], activity: [], role: null });
  }

  const profileId = membership.care_profile_id;

  // Fetch members, invites, and activity in parallel
  const [
    { data: members },
    { data: invites },
    { data: activity },
  ] = await Promise.all([
    admin.from('care_team_members')
      .select('*')
      .eq('care_profile_id', profileId)
      .order('created_at', { ascending: true }),
    admin.from('care_team_invites')
      .select('*')
      .eq('care_profile_id', profileId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    admin.from('care_team_activity')
      .select('*')
      .eq('care_profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  // Enrich members with user info
  const enrichedMembers = await Promise.all(
    (members || []).map(async (m) => {
      const { data: userData } = await admin.auth.admin.getUserById(m.user_id);
      return {
        ...m,
        email: userData?.user?.email || null,
        display_name: userData?.user?.user_metadata?.display_name || userData?.user?.email?.split('@')[0] || 'Unknown',
      };
    })
  );

  return Response.json({
    members: enrichedMembers,
    invites: invites || [],
    activity: activity || [],
    role: membership.role,
    care_profile_id: profileId,
  });
}
