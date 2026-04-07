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

  // 1upHealth uses a different connect flow
  if (providerId === '1uphealth') {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
    });

    // Try to get or create a 1up user ID (optional for sandbox)
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const { createOneUpUser } = await import('@/lib/oneup');
      const admin = createAdminClient();

      const { data: prefs } = await admin
        .from('user_preferences')
        .select('oneup_user_id')
        .eq('user_id', user.id)
        .single();

      let oneupUserId = prefs?.oneup_user_id;

      if (!oneupUserId) {
        oneupUserId = await createOneUpUser(user.id);
        await admin.from('user_preferences').upsert(
          { user_id: user.id, oneup_user_id: oneupUserId },
          { onConflict: 'user_id' }
        );
      }

      if (oneupUserId) {
        params.set('oneup_user_id', oneupUserId);
      }
    } catch (err) {
      // Non-blocking — sandbox mode works without oneup_user_id
      console.error('1upHealth user creation skipped:', err);
    }

    return NextResponse.redirect(`${provider.authorizeUrl}?${params.toString()}`);
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
