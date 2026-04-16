import { db } from '@/lib/db';
import { connectedApps, insurance, claims, notifications } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/api-helpers';
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
  const body = await req.json();
  const { user_id } = body;

  if (!user_id) {
    return Response.json({ error: 'user_id required' }, { status: 400 });
  }

  // Auth: either (a) authenticated user session, or (b) server-side OAuth callback
  const { user: dbUser, error: authError } = await getAuthenticatedUser();

  if (!authError && dbUser) {
    if (dbUser.id !== user_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    const internalSecret = req.headers.get('x-internal-secret');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || internalSecret !== cronSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const [connection] = await db
    .select()
    .from(connectedApps)
    .where(and(eq(connectedApps.userId, user_id), eq(connectedApps.source, 'insurance')))
    .limit(1);

  if (!connection?.accessToken) {
    return Response.json({ error: 'Not connected' }, { status: 400 });
  }

  const token = connection.accessToken;

  const [claimsBundle, coverageBundle] = await Promise.all([
    fetchFhirBundle(token, 'ExplanationOfBenefit'),
    fetchFhirBundle(token, 'Coverage'),
  ]);

  const parsedClaims = parseClaims(claimsBundle);
  const coverage = parseCoverage(coverageBundle);

  // Import coverage as insurance records
  for (const cov of coverage) {
    const existing = await db
      .select({ id: insurance.id })
      .from(insurance)
      .where(and(eq(insurance.userId, user_id), eq(insurance.provider, cov.provider)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(insurance).values({
        userId: user_id,
        provider: cov.provider,
        memberId: cov.member_id,
        groupNumber: cov.group_number,
        planYear: new Date().getFullYear(),
      });
    }
  }

  // Import claims
  for (const claim of parsedClaims) {
    await db.insert(claims).values({
      userId: user_id,
      ...claim,
    });

    // Notify on denied claims
    if (claim.status === 'denied') {
      await db.insert(notifications).values({
        userId: user_id,
        type: 'claim_denied',
        title: `Claim denied: ${claim.provider_name || 'Unknown provider'}`,
        message: claim.denial_reason || 'Your claim was denied. Check with your insurer for details.',
      });
    }
  }

  await db.update(connectedApps).set({ lastSynced: new Date() }).where(eq(connectedApps.id, connection.id));

  return Response.json({
    success: true,
    imported: { claims: parsedClaims.length, coverage: coverage.length },
  });
}
