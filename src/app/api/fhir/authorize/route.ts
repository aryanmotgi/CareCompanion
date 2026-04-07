import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProvider } from '@/lib/fhir-providers';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const providerId = req.nextUrl.searchParams.get('provider');

  if (!providerId) {
    return NextResponse.json({ error: 'provider parameter required' }, { status: 400 });
  }

  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 });
  }

  if (provider.status === 'coming_soon') {
    return NextResponse.json({ error: `${provider.name} is not yet available` }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const clientId = process.env[provider.envClientId];
  const clientSecret = process.env[provider.envClientSecret] || '';
  if (!clientId) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/connect?error=provider_not_configured`);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/fhir/callback`;

  // Encode state with user ID and provider
  const state = Buffer.from(JSON.stringify({
    userId: user.id,
    provider: providerId,
  })).toString('base64url');

  // 1upHealth uses a different connect flow:
  // 1. Create a 1up user → get auth code
  // 2. Exchange code for access_token
  // 3. Redirect to connect widget with access_token
  if (providerId === '1uphealth') {
    try {
      const admin = createAdminClient();

      // Check if we already have a valid access token stored
      const { data: existingConn } = await admin
        .from('connected_apps')
        .select('access_token, expires_at')
        .eq('user_id', user.id)
        .eq('source', '1uphealth')
        .single();

      let accessToken = existingConn?.access_token;
      const isExpired = existingConn?.expires_at && new Date(existingConn.expires_at) < new Date();

      if (!accessToken || isExpired) {
        // Step 1: Create a 1up user (or get existing one)
        const userRes = await fetch('https://api.1up.health/user-management/v1/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            app_user_id: user.id,
          }),
        });

        if (!userRes.ok) {
          const errText = await userRes.text();
          console.error('1upHealth user creation failed:', userRes.status, errText);
          return NextResponse.redirect(`${baseUrl}/connect?error=oneup_user_failed`);
        }

        const userData = await userRes.json();
        const authCode = userData.code;

        // Step 2: Exchange code for access_token
        const tokenRes = await fetch('https://api.1up.health/fhir/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: authCode,
            grant_type: 'authorization_code',
          }).toString(),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error('1upHealth token exchange failed:', tokenRes.status, errText);
          return NextResponse.redirect(`${baseUrl}/connect?error=oneup_token_failed`);
        }

        const tokenData = await tokenRes.json();
        accessToken = tokenData.access_token;

        // Store the connection so we can reuse the token
        await admin.from('connected_apps').upsert(
          {
            user_id: user.id,
            source: '1uphealth',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || null,
            expires_at: tokenData.expires_in
              ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
              : null,
            metadata: {
              oneup_user_id: userData.oneup_user_id,
              provider_id: '1uphealth',
              provider_name: '1upHealth',
            },
          },
          { onConflict: 'user_id,source' }
        );
      }

      // Step 3: Redirect to 1upHealth system search UI
      const connectParams = new URLSearchParams({
        client_id: clientId,
        access_token: accessToken!,
      });

      return NextResponse.redirect(
        `https://system-search.1up.health/search?${connectParams.toString()}`
      );
    } catch (err) {
      console.error('1upHealth authorize error:', err);
      return NextResponse.redirect(`${baseUrl}/connect?error=oneup_error`);
    }
  }

  // Standard SMART on FHIR flow
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: provider.scopes,
    state,
  });

  if (provider.fhirBaseUrl) {
    params.set('aud', provider.fhirBaseUrl);
  }

  // PKCE support
  if (provider.requiresPkce) {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');

    const response = NextResponse.redirect(`${provider.authorizeUrl}?${params.toString()}`);
    response.cookies.set('fhir_pkce_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
    return response;
  }

  return NextResponse.redirect(`${provider.authorizeUrl}?${params.toString()}`);
}
