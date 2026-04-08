import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildAuthUrl, createOneUpUser } from '@/lib/oneup';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createAdminClient();

  // Check if we already have a oneup_user_id for this user
  const { data: prefs } = await admin
    .from('user_preferences')
    .select('oneup_user_id')
    .eq('user_id', user.id)
    .single();

  let oneupUserId = prefs?.oneup_user_id;

  // Create a 1upHealth user if we don't have one yet
  if (!oneupUserId) {
    try {
      oneupUserId = await createOneUpUser(user.id);

      // Store it in user_preferences
      await admin.from('user_preferences').upsert(
        { user_id: user.id, oneup_user_id: oneupUserId },
        { onConflict: 'user_id' }
      );
    } catch (err) {
      console.error('Failed to create 1upHealth user:', err);
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${baseUrl}/connect?error=oneup_user_creation_failed`);
    }
  }

  const authorizeUrl = buildAuthUrl(user.id, oneupUserId);
  return NextResponse.redirect(authorizeUrl);
}
