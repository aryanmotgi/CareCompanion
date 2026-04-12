import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const SwitchSchema = z.object({
  profile_id: z.string().uuid('Valid profile_id is required'),
});

// POST — switch active care profile
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) {
    return apiError('Too many requests', 429);
  }

  try {
    const { valid, error: csrfError } = await validateCsrf(req);
    if (!valid) return csrfError!;

    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    await logAudit({
      user_id: user.id,
      action: 'switch_profile',
      ip_address: req.headers.get('x-forwarded-for') || undefined,
    });

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(SwitchSchema, body);
    if (valError) return valError;

    const { profile_id } = validated;
    const admin = createAdminClient();

    // Verify user has access to this profile (owns it or is on the care team)
    const { data: profile } = await admin
      .from('care_profiles')
      .select('id, patient_name')
      .eq('id', profile_id)
      .single();

    if (!profile) return apiError('Profile not found', 404);

    // Check ownership or care team membership
    const isOwner = await admin.from('care_profiles')
      .select('id').eq('id', profile_id).eq('user_id', user.id).single();

    const isTeamMember = await admin.from('care_team_members')
      .select('id').eq('care_profile_id', profile_id).eq('user_id', user.id).single();

    if (!isOwner.data && !isTeamMember.data) {
      return apiError('You do not have access to this profile', 403);
    }

    // Update active profile
    await admin.from('user_preferences').upsert({
      user_id: user.id,
      active_profile_id: profile_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return apiSuccess({ success: true, message: `Switched to ${profile.patient_name}'s profile.` });
  } catch (err) {
    console.error('[profile-switch] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
