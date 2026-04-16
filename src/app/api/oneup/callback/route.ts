import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { connectedApps } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { exchangeCode } from '@/lib/oneup';
import { syncOneUpData } from '@/lib/oneup-sync';
import { encryptToken, verifyState } from '@/lib/token-encryption';

export const maxDuration = 60;

// This route is kept as a legacy endpoint.
// The primary callback is /api/fhir/callback (registered with 1upHealth).
// Both work — this one uses the oneup.ts helpers directly.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/connect?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/connect?error=missing_code`);
  }

  const stateData = verifyState(state || '');
  if (!stateData) {
    return NextResponse.redirect(`${baseUrl}/connect?error=invalid_state`);
  }

  const userId = stateData.userId;
  const provider = stateData.provider || '1uphealth';

  if (!userId) {
    return NextResponse.redirect(`${baseUrl}/connect?error=invalid_state`);
  }

  const { user: dbUser, error: authError } = await getAuthenticatedUser();
  if (authError || dbUser!.id !== userId) {
    return NextResponse.redirect(`${baseUrl}/connect?error=auth_mismatch`);
  }

  try {
    const tokens = await exchangeCode(code);

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    const source = provider === '1uphealth' ? '1uphealth' : 'epic';

    await db.delete(connectedApps).where(
      and(eq(connectedApps.userId, dbUser!.id), eq(connectedApps.source, source))
    );

    await db.insert(connectedApps).values({
      userId: dbUser!.id,
      source,
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expiresAt,
      metadata: { patient_id: tokens.patient || null, provider },
    });

    syncOneUpData(dbUser!.id, tokens.access_token).catch((err) => {
      console.error(`Initial ${source} sync error:`, err);
    });

    return NextResponse.redirect(`${baseUrl}/connect?connected=${source}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(`${baseUrl}/connect?error=token_exchange_failed`);
  }
}
