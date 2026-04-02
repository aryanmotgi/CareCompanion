import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get the active care profile for a user.
 * Falls back to first profile if no preference is set.
 */
export async function getActiveProfile(supabase: SupabaseClient, userId: string) {
  const admin = createAdminClient();

  // Check user preferences for active profile
  const { data: prefs } = await admin
    .from('user_preferences')
    .select('active_profile_id')
    .eq('user_id', userId)
    .single();

  if (prefs?.active_profile_id) {
    // Verify the profile exists and belongs to this user (or they're on the care team)
    const { data: profile } = await supabase
      .from('care_profiles')
      .select('*')
      .eq('id', prefs.active_profile_id)
      .single();

    if (profile) return profile;
  }

  // Fallback: get first profile owned by this user
  const { data: profile } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  // If found, save as active
  if (profile) {
    await admin.from('user_preferences').upsert({
      user_id: userId,
      active_profile_id: profile.id,
    }, { onConflict: 'user_id' });
  }

  return profile;
}

/**
 * Get all care profiles accessible to a user (owned + care team).
 */
export async function getAllProfiles(supabase: SupabaseClient, userId: string) {
  // Get profiles the user owns
  const { data: owned } = await supabase
    .from('care_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  // Get profiles from care team memberships
  const admin = createAdminClient();
  const { data: teamMemberships } = await admin
    .from('care_team_members')
    .select('care_profile_id')
    .eq('user_id', userId)
    .neq('role', 'owner'); // Owned profiles already fetched above

  const sharedProfileIds = (teamMemberships || [])
    .map((m) => m.care_profile_id)
    .filter((id) => !(owned || []).some((p) => p.id === id));

  let shared: typeof owned = [];
  if (sharedProfileIds.length > 0) {
    const { data } = await admin
      .from('care_profiles')
      .select('*')
      .in('id', sharedProfileIds);
    shared = data || [];
  }

  return [...(owned || []), ...shared];
}
