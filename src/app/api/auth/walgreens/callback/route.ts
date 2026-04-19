import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { connectedApps } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://carecompanionai.app');

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?error=oauth_failed`);
  }

  try {
    const tokenRes = await fetch('https://developer.walgreens.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.WALGREENS_CLIENT_ID!,
        client_secret: process.env.WALGREENS_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/walgreens/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${appUrl}/settings?error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();

    await db.delete(connectedApps).where(
      and(eq(connectedApps.userId, state), eq(connectedApps.source, 'walgreens'))
    );
    await db.insert(connectedApps).values({
      userId: state,
      source: 'walgreens',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
    });

    return NextResponse.redirect(`${appUrl}/settings?connected=walgreens`);
  } catch {
    return NextResponse.redirect(`${appUrl}/settings?error=oauth_error`);
  }
}
