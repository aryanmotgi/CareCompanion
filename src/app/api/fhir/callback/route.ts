import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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

  // Verify HMAC-signed state — rejects tampered or forged state values
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${baseUrl}/connect?error=auth_mismatch`);
  }

  const clientId = process.env[provider.envClientId] || '';
  const clientSecret = process.env[provider.envClientSecret] || '';
  const redirectUri = `${baseUrl}/api/fhir/callback`;

  try {
    // Build token exchange request
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
    });

    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }

    // PKCE: include code_verifier if this provider requires it
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
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // For 1upHealth, use '1uphealth' as source to match oneup-sync expectations
    const source = providerId === '1uphealth' ? '1uphealth' : `fhir_${providerId}`;

    const admin = createAdminClient();

    // Save the connection — tokens encrypted at rest
    const { error: upsertError } = await admin.from('connected_apps').upsert(
      {
        user_id: user.id,
        source,
        access_token: encryptToken(tokens.access_token),
        refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        expires_at: expiresAt,
        metadata: {
          provider_id: providerId,
          provider_name: provider.name,
          patient_id: tokens.patient || null,
          fhir_base_url: provider.fhirBaseUrl,
          connected_at: new Date().toISOString(),
        },
      },
      { onConflict: 'user_id,source' }
    );

    if (upsertError) {
      console.error('Failed to save connection:', upsertError);
      return NextResponse.redirect(`${baseUrl}/connect?error=save_failed`);
    }

    // Trigger initial sync — pass plaintext token directly (not re-read from DB)
    if (providerId === '1uphealth') {
      syncOneUpData(user.id, tokens.access_token).catch((err) => {
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

    // Clear PKCE cookie if used
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
