import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { connectedApps } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { verifyState, encryptToken } from '@/lib/token-encryption';
import { getAuthenticatedUser } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state'); // user_id
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://carecompanionai.app');

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?error=oauth_failed`);
  }

  // Verify HMAC-signed state to prevent CSRF
  const statePayload = verifyState(state);
  if (!statePayload || !statePayload.userId) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_state`);
  }
  const userId = statePayload.userId;

  // Verify the authenticated session user matches the state user
  const { user: sessionUser } = await getAuthenticatedUser();
  if (!sessionUser || sessionUser.id !== userId) {
    return NextResponse.redirect(`${appUrl}/settings?error=session_mismatch`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/google-calendar/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${appUrl}/settings?error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();

    // Save to connected_apps (delete + insert to avoid needing composite unique constraint)
    await db.delete(connectedApps).where(
      and(eq(connectedApps.userId, userId), eq(connectedApps.source, 'google_calendar'))
    );
    await db.insert(connectedApps).values({
      userId,
      source: 'google_calendar',
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
      lastSynced: null,
    });

    // Trigger initial sync (pass internal secret so sync route trusts the callback)
    await fetch(`${appUrl}/api/sync/google-calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CRON_SECRET ? { 'x-internal-secret': process.env.CRON_SECRET } : {}),
      },
      body: JSON.stringify({ user_id: userId }),
    });

    return NextResponse.redirect(`${appUrl}/settings?connected=google_calendar`);
  } catch {
    return NextResponse.redirect(`${appUrl}/settings?error=oauth_error`);
  }
}
