import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST — switch active care profile
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { profile_id } = await req.json();
  if (!profile_id) return Response.json({ error: 'profile_id required' }, { status: 400 });

  const admin = createAdminClient();

  // Verify user has access to this profile (owns it or is on the care team)
  const { data: profile } = await admin
    .from('care_profiles')
    .select('id, patient_name')
    .eq('id', profile_id)
    .single();

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

  // Check ownership or care team membership
  const isOwner = await admin.from('care_profiles')
    .select('id').eq('id', profile_id).eq('user_id', user.id).single();

  const isTeamMember = await admin.from('care_team_members')
    .select('id').eq('care_profile_id', profile_id).eq('user_id', user.id).single();

  if (!isOwner.data && !isTeamMember.data) {
    return Response.json({ error: 'You do not have access to this profile' }, { status: 403 });
  }

  // Update active profile
  await admin.from('user_preferences').upsert({
    user_id: user.id,
    active_profile_id: profile_id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return Response.json({ success: true, message: `Switched to ${profile.patient_name}'s profile.` });
}
