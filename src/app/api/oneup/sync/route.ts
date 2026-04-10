import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncOneUpData } from '@/lib/oneup-sync';
import { safeDecryptToken } from '@/lib/token-encryption';

export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createAdminClient();

  // Get 1upHealth connection
  const { data: app } = await admin
    .from('connected_apps')
    .select('*')
    .eq('user_id', user.id)
    .eq('source', '1uphealth')
    .single();

  if (!app || !app.access_token) {
    return Response.json({ error: 'Not connected to 1upHealth' }, { status: 400 });
  }

  const accessToken = safeDecryptToken(app.access_token);
  if (!accessToken) {
    return Response.json({ error: 'Token decryption failed — please reconnect' }, { status: 401 });
  }

  try {
    const results = await syncOneUpData(user.id, accessToken);
    return Response.json({ success: true, synced: results });
  } catch (err) {
    console.error('1upHealth sync error:', err);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}
