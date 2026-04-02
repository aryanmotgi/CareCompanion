import { createClient } from '@/lib/supabase/server';

// POST — save or update today's symptom entry
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const today = new Date().toISOString().split('T')[0];

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  const { data: entry, error } = await supabase
    .from('symptom_entries')
    .upsert({
      user_id: user.id,
      care_profile_id: profile?.id || null,
      date: today,
      ...body,
    }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true, entry });
}

// GET — fetch symptom entries
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get('days') || '14');
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data } = await supabase
    .from('symptom_entries')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', since)
    .order('date', { ascending: false });

  return Response.json({ entries: data || [] });
}
