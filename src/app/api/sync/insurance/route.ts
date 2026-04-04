import { createAdminClient } from '@/lib/supabase/admin';
import { parseClaims, parseCoverage, type FhirBundle } from '@/lib/fhir';

async function fetchFhirBundle(accessToken: string, resourceType: string): Promise<FhirBundle> {
  const res = await fetch(
    `https://api.1up.health/fhir/r4/${resourceType}?_count=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return { resourceType: 'Bundle', entry: [] };
  return res.json();
}

export async function POST(req: Request) {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { user_id } = await req.json();
  if (!user_id) {
    return Response.json({ error: 'user_id required' }, { status: 400 });
  }

  if (user && user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  // If no session (server-side OAuth callback), verify internal secret
  if (!user) {
    const internalSecret = req.headers.get('x-internal-secret');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || internalSecret !== cronSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { data: connection } = await admin
    .from('connected_apps')
    .select('*')
    .eq('user_id', user_id)
    .eq('source', 'insurance')
    .single();

  if (!connection?.access_token) {
    return Response.json({ error: 'Not connected' }, { status: 400 });
  }

  const token = connection.access_token;

  const [claimsBundle, coverageBundle] = await Promise.all([
    fetchFhirBundle(token, 'ExplanationOfBenefit'),
    fetchFhirBundle(token, 'Coverage'),
  ]);

  const claims = parseClaims(claimsBundle);
  const coverage = parseCoverage(coverageBundle);

  // Import coverage as insurance records
  for (const cov of coverage) {
    const { data: existing } = await admin
      .from('insurance')
      .select('id')
      .eq('user_id', user_id)
      .eq('provider', cov.provider)
      .limit(1);

    if (!existing || existing.length === 0) {
      await admin.from('insurance').insert({
        user_id,
        provider: cov.provider,
        member_id: cov.member_id,
        group_number: cov.group_number,
        plan_year: new Date().getFullYear(),
      });
    }
  }

  // Import claims
  for (const claim of claims) {
    await admin.from('claims').insert({
      user_id,
      ...claim,
    });

    // Notify on denied claims
    if (claim.status === 'denied') {
      await admin.from('notifications').insert({
        user_id,
        type: 'claim_denied',
        title: `Claim denied: ${claim.provider_name || 'Unknown provider'}`,
        message: claim.denial_reason || 'Your claim was denied. Check with your insurer for details.',
      });
    }
  }

  await admin
    .from('connected_apps')
    .update({ last_synced: new Date().toISOString() })
    .eq('id', connection.id);

  return Response.json({
    success: true,
    imported: { claims: claims.length, coverage: coverage.length },
  });
}
