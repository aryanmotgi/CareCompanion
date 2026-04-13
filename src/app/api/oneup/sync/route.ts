import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncOneUpData, TokenExpiredError } from '@/lib/oneup-sync';
import { safeDecryptToken } from '@/lib/token-encryption';

export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createAdminClient();

  // Get 1upHealth connection — newest row first in case of duplicates
  const { data: app } = await admin
    .from('connected_apps')
    .select('*')
    .eq('user_id', user.id)
    .eq('source', '1uphealth')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!app || !app.access_token) {
    return Response.json({ error: 'Not connected to 1upHealth' }, { status: 400 });
  }

  const accessToken = safeDecryptToken(app.access_token);
  if (!accessToken) {
    // Token can't be decrypted — mark as expired so next authorize flow re-auths
    await admin.from('connected_apps')
      .update({ expires_at: new Date(0).toISOString() })
      .eq('user_id', user.id)
      .eq('source', '1uphealth');
    return Response.json({ error: 'token_expired' }, { status: 401 });
  }

  try {
    const results = await syncOneUpData(user.id, accessToken);
    return Response.json({ success: true, synced: results });
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      // 1upHealth rejected the token — mark expired so next authorize re-auths
      await admin.from('connected_apps')
        .update({ expires_at: new Date(0).toISOString() })
        .eq('user_id', user.id)
        .eq('source', '1uphealth');
      return Response.json({ error: 'token_expired' }, { status: 401 });
    }
    console.error('1upHealth sync error:', err);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}
