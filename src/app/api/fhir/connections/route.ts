import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: connections } = await supabase
    .from('connected_apps')
    .select('source, last_synced, metadata, expires_at')
    .eq('user_id', user.id);

  // Map to a cleaner format
  const connected = (connections || []).map((c) => ({
    source: c.source,
    provider_name: (c.metadata as Record<string, string>)?.provider_name || c.source,
    last_synced: c.last_synced,
    is_expired: c.expires_at ? new Date(c.expires_at) < new Date() : false,
  }));

  return Response.json({ connections: connected });
}
