/**
 * Revoke 1upHealth connection.
 *
 * Best-effort revokes the access token at 1upHealth's OAuth server,
 * then deletes the local connected_apps row. The revocation call is
 * non-fatal — we always delete locally even if 1upHealth's endpoint
 * returns an error (network issue, already-expired token, etc.).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeDecryptToken } from '@/lib/token-encryption';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: conn } = await admin
    .from('connected_apps')
    .select('id, access_token, refresh_token')
    .eq('user_id', user.id)
    .eq('source', '1uphealth')
    .single();

  if (!conn) {
    return NextResponse.json({ success: true }); // already disconnected
  }

  const clientId = process.env.ONEUP_CLIENT_ID;
  const clientSecret = process.env.ONEUP_CLIENT_SECRET || '';

  // Best-effort: revoke access token at 1upHealth (RFC 7009)
  if (clientId && conn.access_token) {
    try {
      const accessToken = safeDecryptToken(conn.access_token);
      if (accessToken) {
        await fetch('https://api.1up.health/oauth2/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            token: accessToken,
            token_type_hint: 'access_token',
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
        });
      }

      // Also revoke refresh token if present
      if (conn.refresh_token) {
        const refreshToken = safeDecryptToken(conn.refresh_token);
        if (refreshToken) {
          await fetch('https://api.1up.health/oauth2/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              token: refreshToken,
              token_type_hint: 'refresh_token',
              client_id: clientId,
              client_secret: clientSecret,
            }).toString(),
          });
        }
      }
    } catch (err) {
      // Non-fatal — always delete locally
      console.error('[oneup/revoke] Token revocation failed (continuing with local delete):', err instanceof Error ? err.message : err);
    }
  }

  // Delete local connection record
  const { error } = await admin
    .from('connected_apps')
    .delete()
    .eq('id', conn.id);

  if (error) {
    console.error('[oneup/revoke] DB delete failed:', error.message);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  console.log(`[oneup/revoke] User ${user.id} disconnected from 1upHealth`);
  return NextResponse.json({ success: true });
}
