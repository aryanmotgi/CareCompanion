import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exchangeCode } from '@/lib/oneup';
import { syncOneUpData } from '@/lib/oneup-sync';

export const maxDuration = 60;

// This route is kept as a legacy endpoint.
// The primary callback is /api/fhir/callback (registered with 1upHealth).
// Both work — this one uses the oneup.ts helpers directly.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/connect?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/connect?error=missing_code`);
  }

  let userId: string;
  let provider: string;
  try {
    const stateData = JSON.parse(Buffer.from(state || '', 'base64url').toString());
    userId = stateData.userId;
    provider = stateData.provider || '1uphealth';
  } catch {
    return NextResponse.redirect(`${baseUrl}/connect?error=invalid_state`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${baseUrl}/connect?error=auth_mismatch`);
  }

  try {
    const tokens = await exchangeCode(code);

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const source = provider === '1uphealth' ? '1uphealth' : 'epic';

    const admin = createAdminClient();
    await admin.from('connected_apps').upsert(
      {
        user_id: user.id,
        source,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: expiresAt,
        metadata: { patient_id: tokens.patient || null, provider },
      },
      { onConflict: 'user_id,source' }
    );

    // Trigger initial sync (non-blocking)
    syncOneUpData(user.id, tokens.access_token).catch((err) => {
      console.error(`Initial ${source} sync error:`, err);
    });

    return NextResponse.redirect(`${baseUrl}/connect?connected=${source}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(`${baseUrl}/connect?error=token_exchange_failed`);
  }
}
