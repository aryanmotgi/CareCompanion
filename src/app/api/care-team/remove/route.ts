import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { validateCsrf } from '@/lib/csrf';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const RemoveSchema = z.object({
  member_id: z.string().uuid('Valid member_id is required'),
});

// POST — remove a member from the care team or leave the team
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
    const { data: validated, error: valError } = validateBody(RemoveSchema, body);
    if (valError) return valError;

    const { member_id } = validated;
    const admin = createAdminClient();

    // Get the target member
    const { data: target } = await admin
      .from('care_team_members')
      .select('*')
      .eq('id', member_id)
      .single();

    if (!target) {
      return apiError('Member not found', 404);
    }

    // Can't remove the owner
    if (target.role === 'owner') {
      return apiError('Cannot remove the profile owner', 403);
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
        return apiError('Only the owner can remove other team members', 403);
      }
    }

    // Remove the member
    const { error } = await admin.from('care_team_members').delete().eq('id', member_id);
    if (error) {
      return apiError(error.message, 500);
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

    return apiSuccess({ success: true });
  } catch (err) {
    console.error('[care-team/remove] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
