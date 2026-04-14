import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProvider } from '@/lib/fhir-providers';
import { encryptToken, safeDecryptToken, signState } from '@/lib/token-encryption';
import crypto from 'crypto';

/**
 * Get a fresh 1upHealth auth code for the given user.
 *
 * 1upHealth has two relevant states:
 *   A) User does not yet exist on 1upHealth → auth-code fails, user-create returns a code
 *   B) User exists on 1upHealth → auth-code should return a code
 *
 * However, auth-code can return HTTP 200 with { success: false, code: null }
 * transiently (flaky API, sandbox resets, etc.) even when the user exists.
 * In that case, user-create returns HTTP 200 with fhir_user_id but NO code.
 *
 * Full strategy:
 *   1. Try auth-code  →  success: return code
 *   2. Try user-create → if new user (code present): return code
 *   3. user-create confirms user exists (fhir_user_id, no code) → retry auth-code once
 *   4. All three fail → return error
 */
async function getOneUpAuthCode(
  clientId: string,
  clientSecret: string,
  appUserId: string,
): Promise<{ code: string } | { error: string; status: number }> {
  async function tryAuthCode() {
    const res = await fetch('https://api.1up.health/user-management/v1/user/auth-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, app_user_id: appUserId }),
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { res, data };
  }

  // Step 1: auth-code (works for existing users)
  const { res: codeRes, data: codeData } = await tryAuthCode();
  if (codeRes.ok && codeData.code) {
    return { code: codeData.code as string };
  }
  console.warn('[1upHealth] auth-code attempt 1 returned no code:', codeData);

  // Step 2: user-create (works for new users, also confirms existing users)
  const createRes = await fetch('https://api.1up.health/user-management/v1/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, app_user_id: appUserId }),
  });
  const createData = await createRes.json().catch(() => ({})) as Record<string, unknown>;

  if (createRes.ok && createData.code) {
    // New user created — code returned
    return { code: createData.code as string };
  }

  if (createRes.ok && createData.fhir_user_id) {
    // User already existed on 1upHealth's side, auth-code was just flaky.
    // Retry auth-code once more.
    console.warn('[1upHealth] user exists but auth-code was flaky — retrying auth-code');
    const { res: retryRes, data: retryData } = await tryAuthCode();
    if (retryRes.ok && retryData.code) {
      return { code: retryData.code as string };
    }
    console.error('[1upHealth] auth-code retry also failed:', retryData);
    return { error: (retryData?.error as string) || 'auth-code retry failed', status: retryRes.status };
  }

  const errDetail = (createData?.error as string) || (codeData?.error as string) || `HTTP ${createRes.status}`;
  console.error('[1upHealth] user create also failed:', createData);
  return { error: errDetail, status: createRes.status };
}

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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId) {
    return NextResponse.redirect(`${baseUrl}/connect?error=provider_not_configured`);
  }

  const redirectUri = `${baseUrl}/api/fhir/callback`;

  // HMAC-signed state — prevents CSRF and state tampering
  const state = signState({ userId: user.id, provider: providerId });

  // 1upHealth uses a different connect flow:
  // 1. Get or create a 1upHealth user → get auth code
  // 2. Exchange code for access_token
  // 3. Redirect to connect widget with access_token
  if (providerId === '1uphealth') {
    try {
      const admin = createAdminClient();

      // Check if we already have a valid (non-expired) token stored.
      // Use maybeSingle() so duplicate rows (DB inconsistency) don't throw.
      const { data: existingConn } = await admin
        .from('connected_apps')
        .select('access_token, expires_at')
        .eq('user_id', user.id)
        .eq('source', '1uphealth')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Treat token as expired if expires_at is missing (unknown expiry) or in the past.
      // Legacy rows may have expires_at=null — treat them as expired and re-auth.
      // New connections store expires_at with a 7-day default.
      const isExpired = !existingConn?.expires_at || new Date(existingConn.expires_at) < new Date();
      // safeDecryptToken returns null on decryption failure (key rotation, corruption)
      // so we fall through to fetch a fresh token instead of crashing
      let accessToken = existingConn?.access_token
        ? safeDecryptToken(existingConn.access_token)
        : null;

      if (!accessToken || isExpired) {
        // Step 1: Get or create a 1upHealth user and obtain an auth code.
        // Uses a two-stage fallback: auth-code → user-create.
        // This handles sandbox resets, new users, and re-connects gracefully.
        const codeResult = await getOneUpAuthCode(clientId, clientSecret, user.id);

        if ('error' in codeResult) {
          console.error('[1upHealth] could not obtain auth code:', codeResult.error);
          const encoded = encodeURIComponent(codeResult.error.slice(0, 200));
          return NextResponse.redirect(`${baseUrl}/connect?error=oneup_user_failed&detail=${encoded}`);
        }

        // Step 2: Exchange code for access_token
        const tokenRes = await fetch('https://api.1up.health/fhir/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: codeResult.code,
            grant_type: 'authorization_code',
          }).toString(),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text().catch(() => `HTTP ${tokenRes.status}`);
          console.error('1upHealth token exchange failed:', tokenRes.status, errText);
          const encoded = encodeURIComponent(errText.slice(0, 200));
          return NextResponse.redirect(`${baseUrl}/connect?error=oneup_token_failed&detail=${encoded}`);
        }

        const tokenData = await tokenRes.json().catch((e: unknown) => {
          console.error('[1upHealth] token response was not valid JSON:', e);
          return null;
        });

        if (!tokenData) {
          return NextResponse.redirect(`${baseUrl}/connect?error=oneup_token_failed&detail=invalid_json_response`);
        }

        if (!tokenData.access_token) {
          console.error('[1upHealth] token response missing access_token:', tokenData);
          return NextResponse.redirect(`${baseUrl}/connect?error=oneup_token_failed&detail=no_access_token`);
        }

        accessToken = tokenData.access_token;

        // Default expires_in to 7 days if the response doesn't include it.
        // 1upHealth tokens are long-lived — using 1hr caused unnecessary re-auth on every visit.
        const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 7 * 24 * 3600;

        // Store the connection — tokens encrypted at rest (encryptToken degrades to plaintext if key misconfigured)
        let encryptedAccess: string;
        let encryptedRefresh: string | null = null;
        try {
          encryptedAccess = encryptToken(tokenData.access_token);
          encryptedRefresh = tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null;
        } catch (encErr) {
          // Should not happen after the getEncryptionKey fix, but belt-and-suspenders:
          // store plaintext so the flow doesn't break
          console.error('[1upHealth] encryptToken threw — storing token as plaintext:', encErr);
          encryptedAccess = tokenData.access_token;
          encryptedRefresh = tokenData.refresh_token ?? null;
        }

        // Delete any existing rows for this user+source, then insert fresh.
        // Using delete+insert instead of upsert avoids needing a unique constraint on (user_id, source).
        await admin.from('connected_apps')
          .delete()
          .eq('user_id', user.id)
          .eq('source', '1uphealth');

        const { error: insertErr } = await admin.from('connected_apps').insert({
          user_id: user.id,
          source: '1uphealth',
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
          metadata: {
            oneup_user_id: user.id,
            provider_id: '1uphealth',
            provider_name: '1upHealth',
            connected_at: new Date().toISOString(),
          },
        });
        if (insertErr) {
          // Non-fatal: we still have the token in memory; log and continue
          console.error('[1upHealth] failed to save connection in DB:', insertErr.message);
        }
      }

      // Step 3: Redirect to 1upHealth system search UI (requires plaintext token).
      // redirect_uri tells 1upHealth where to send the user after hospital login.
      const connectParams = new URLSearchParams({
        client_id: clientId,
        access_token: accessToken!,
        redirect_uri: `${baseUrl}/api/oneup/connected`,
      });

      return NextResponse.redirect(
        `https://system-search.1up.health/search?${connectParams.toString()}`
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[fhir/authorize] 1upHealth error:', errMsg, err);
      const encodedMsg = encodeURIComponent(errMsg.slice(0, 200));
      return NextResponse.redirect(`${baseUrl}/connect?error=oneup_error&detail=${encodedMsg}`);
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

  // PKCE support (required for Epic, Cerner, VA)
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
