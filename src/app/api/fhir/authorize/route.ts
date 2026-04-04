import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: provider.scopes,
    state,
  });

  // FHIR servers need the audience parameter
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

    // Store code_verifier in a cookie for the callback
    const response = NextResponse.redirect(`${provider.authorizeUrl}?${params.toString()}`);
    response.cookies.set('fhir_pkce_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });
    return response;
  }

  return NextResponse.redirect(`${provider.authorizeUrl}?${params.toString()}`);
}
