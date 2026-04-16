import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { connectedApps } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { getProvider } from '@/lib/fhir-providers';
import { encryptToken, safeDecryptToken, signState } from '@/lib/token-encryption';
import crypto from 'crypto';

/**
 * Get a fresh 1upHealth auth code for the given user.
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

  const { res: codeRes, data: codeData } = await tryAuthCode();
  if (codeRes.ok && codeData.code) {
    return { code: codeData.code as string };
  }
  console.warn('[1upHealth] auth-code attempt 1 returned no code:', codeData);

  const createRes = await fetch('https://api.1up.health/user-management/v1/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, app_user_id: appUserId }),
  });
  const createData = await createRes.json().catch(() => ({})) as Record<string, unknown>;

  if (createRes.ok && createData.code) {
    return { code: createData.code as string };
  }

  if (createRes.ok && createData.fhir_user_id) {
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

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return NextResponse.redirect(new URL('/login', req.url));

  const clientId = process.env[provider.envClientId];
  const clientSecret = process.env[provider.envClientSecret] || '';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId) {
    return NextResponse.redirect(`${baseUrl}/connect?error=provider_not_configured`);
  }

  const redirectUri = `${baseUrl}/api/fhir/callback`;

  // HMAC-signed state — prevents CSRF and state tampering
  // Use dbUser.id (local DB UUID) as the userId in state
  const state = signState({ userId: dbUser!.id, provider: providerId });

  if (providerId === '1uphealth') {
    try {
      const [existingConn] = await db
        .select({ accessToken: connectedApps.accessToken, expiresAt: connectedApps.expiresAt })
        .from(connectedApps)
        .where(and(eq(connectedApps.userId, dbUser!.id), eq(connectedApps.source, '1uphealth')))
        .orderBy(desc(connectedApps.createdAt))
        .limit(1);

      const isExpired = !existingConn?.expiresAt || new Date(existingConn.expiresAt) < new Date();
      let accessToken = existingConn?.accessToken
        ? safeDecryptToken(existingConn.accessToken)
        : null;

      if (!accessToken || isExpired) {
        const codeResult = await getOneUpAuthCode(clientId, clientSecret, dbUser!.id);

        if ('error' in codeResult) {
          console.error('[1upHealth] could not obtain auth code:', codeResult.error);
          const encoded = encodeURIComponent(codeResult.error.slice(0, 200));
          return NextResponse.redirect(`${baseUrl}/connect?error=oneup_user_failed&detail=${encoded}`);
        }

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

        const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 7 * 24 * 3600;

        let encryptedAccess: string;
        let encryptedRefresh: string | null = null;
        try {
          encryptedAccess = encryptToken(tokenData.access_token);
          encryptedRefresh = tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null;
        } catch (encErr) {
          console.error('[1upHealth] encryptToken threw — storing token as plaintext:', encErr);
          encryptedAccess = tokenData.access_token;
          encryptedRefresh = tokenData.refresh_token ?? null;
        }

        await db.delete(connectedApps).where(
          and(eq(connectedApps.userId, dbUser!.id), eq(connectedApps.source, '1uphealth'))
        );

        await db.insert(connectedApps).values({
          userId: dbUser!.id,
          source: '1uphealth',
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          expiresAt: new Date(Date.now() + expiresIn * 1000),
          metadata: {
            oneup_user_id: dbUser!.id,
            provider_id: '1uphealth',
            provider_name: '1upHealth',
            connected_at: new Date().toISOString(),
          },
        });
      }

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
