import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

    const admin = createAdminClient();
    await admin.from('connected_apps').upsert(
      {
        user_id: state,
        source: 'walgreens',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
      },
      { onConflict: 'user_id,source' }
    );

    return NextResponse.redirect(`${appUrl}/settings?connected=walgreens`);
  } catch {
    return NextResponse.redirect(`${appUrl}/settings?error=oauth_error`);
  }
}
