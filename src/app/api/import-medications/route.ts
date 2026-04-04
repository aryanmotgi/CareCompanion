import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_MEDICATIONS_PER_IMPORT = 50;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Rate limit: 20 imports per minute
  const rateCheck = checkRateLimit(`import-meds:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
  if (!rateCheck.allowed) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.retryAfterMs / 1000)) } }
    );
  }

  const { medications, source } = await req.json();

  if (!Array.isArray(medications) || medications.length === 0) {
    return Response.json({ error: 'medications array is required' }, { status: 400 });
  }

  if (medications.length > MAX_MEDICATIONS_PER_IMPORT) {
    return Response.json({ error: `Max ${MAX_MEDICATIONS_PER_IMPORT} medications per import` }, { status: 400 });
  }

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
