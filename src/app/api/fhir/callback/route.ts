import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { connectedApps } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { getProvider } from '@/lib/fhir-providers';
import { syncOneUpData } from '@/lib/oneup-sync';
import { encryptToken, verifyState } from '@/lib/token-encryption';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');
  const errorDescription = req.nextUrl.searchParams.get('error_description');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    console.error('FHIR OAuth error:', error, errorDescription);
    return NextResponse.redirect(`${baseUrl}/connect?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/connect?error=missing_code`);
  }

  const stateData = verifyState(state);
  if (!stateData) {
    return NextResponse.redirect(`${baseUrl}/connect?error=invalid_state`);
  }

  const userId = stateData.userId;
  const providerId = stateData.provider;

  if (!userId || !providerId) {
    return NextResponse.redirect(`${baseUrl}/connect?error=invalid_state`);
  }

  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.redirect(`${baseUrl}/connect?error=unknown_provider`);
  }

  // Verify the authenticated user matches the one who initiated the flow
  const { user: dbUser, error: authError } = await getAuthenticatedUser();
  if (authError || dbUser!.id !== userId) {
    return NextResponse.redirect(`${baseUrl}/connect?error=auth_mismatch`);
  }

  const clientId = process.env[provider.envClientId] || '';
  const clientSecret = process.env[provider.envClientSecret] || '';
  const redirectUri = `${baseUrl}/api/fhir/callback`;

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
    });

    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }

    if (provider.requiresPkce) {
      const codeVerifier = req.cookies.get('fhir_pkce_verifier')?.value;
      if (codeVerifier) {
        body.set('code_verifier', codeVerifier);
      }
    }

    const tokenRes = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error(`Token exchange failed for ${providerId}:`, tokenRes.status, errorText);
      return NextResponse.redirect(`${baseUrl}/connect?error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    const source = providerId === '1uphealth' ? '1uphealth' : `fhir_${providerId}`;

    // Delete existing row then insert fresh (avoids needing unique constraint)
    await db.delete(connectedApps).where(
      and(eq(connectedApps.userId, dbUser!.id), eq(connectedApps.source, source))
    );

    await db.insert(connectedApps).values({
      userId: dbUser!.id,
      source,
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expiresAt,
      metadata: {
        provider_id: providerId,
        provider_name: provider.name,
        patient_id: tokens.patient || null,
        fhir_base_url: provider.fhirBaseUrl,
        connected_at: new Date().toISOString(),
      },
    });

    // Trigger initial sync
    if (providerId === '1uphealth') {
      syncOneUpData(dbUser!.id, tokens.access_token).catch((err) => {
        console.error('1upHealth initial sync error:', err);
      });
    } else {
      fetch(`${baseUrl}/api/fhir/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId }),
      }).catch((err) => {
        console.error(`Background sync failed for ${providerId}:`, err);
      });
    }

    const response = NextResponse.redirect(`${baseUrl}/connect?connected=${providerId}`);
    if (provider.requiresPkce) {
      response.cookies.delete('fhir_pkce_verifier');
    }

    return response;
  } catch (err) {
    console.error('FHIR OAuth callback error:', err);
    return NextResponse.redirect(`${baseUrl}/connect?error=oauth_error`);
  }
}
