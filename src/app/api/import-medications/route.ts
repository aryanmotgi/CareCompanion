import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { medications, source } = await req.json();

  // Get care profile
  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return Response.json({ error: 'No care profile found' }, { status: 400 });
  }

  // Insert all medications
  const rows = medications.map((med: { name: string; dose: string; frequency: string }) => ({
    care_profile_id: profile.id,
    name: med.name,
    dose: med.dose || null,
    frequency: med.frequency || null,
    notes: source ? `Imported from ${source}` : null,
  }));

  const { error } = await supabase.from('medications').insert(rows);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, count: rows.length });
}
