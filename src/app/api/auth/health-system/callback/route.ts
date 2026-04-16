import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { connectedApps } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?error=oauth_failed`);
  }

  try {
    // Exchange code for tokens with 1upHealth
    const tokenRes = await fetch('https://api.1up.health/fhir/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.ONEUPH_CLIENT_ID!,
        client_secret: process.env.ONEUPH_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/health-system/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${appUrl}/settings?error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();

    await db.delete(connectedApps).where(
      and(eq(connectedApps.userId, state), eq(connectedApps.source, 'health_system'))
    );
    await db.insert(connectedApps).values({
      userId: state,
      source: 'health_system',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
    });

    // Trigger initial FHIR sync (pass internal secret so sync route trusts the callback)
    await fetch(`${appUrl}/api/sync/health-system`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CRON_SECRET ? { 'x-internal-secret': process.env.CRON_SECRET } : {}),
      },
      body: JSON.stringify({ user_id: state }),
    });

    return NextResponse.redirect(`${appUrl}/settings?connected=health_system`);
  } catch {
    return NextResponse.redirect(`${appUrl}/settings?error=oauth_error`);
  }
}
