/**
 * Revoke 1upHealth connection.
 *
 * Best-effort revokes the access token at 1upHealth's OAuth server,
 * then deletes the local connected_apps row. The revocation call is
 * non-fatal — we always delete locally even if 1upHealth's endpoint
 * returns an error (network issue, already-expired token, etc.).
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { connectedApps } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { safeDecryptToken } from '@/lib/token-encryption';

export async function POST() {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [conn] = await db
    .select({ id: connectedApps.id, accessToken: connectedApps.accessToken, refreshToken: connectedApps.refreshToken })
    .from(connectedApps)
    .where(and(eq(connectedApps.userId, dbUser!.id), eq(connectedApps.source, '1uphealth')))
    .limit(1);

  if (!conn) {
    return NextResponse.json({ success: true }); // already disconnected
  }

  const clientId = process.env.ONEUP_CLIENT_ID;
  const clientSecret = process.env.ONEUP_CLIENT_SECRET || '';

  if (clientId && conn.accessToken) {
    try {
      const accessToken = safeDecryptToken(conn.accessToken);
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

      if (conn.refreshToken) {
        const refreshToken = safeDecryptToken(conn.refreshToken);
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
      console.error('[oneup/revoke] Token revocation failed (continuing with local delete):', err instanceof Error ? err.message : err);
    }
  }

  await db.delete(connectedApps).where(eq(connectedApps.id, conn.id));

  console.log(`[oneup/revoke] User ${dbUser!.id} disconnected from 1upHealth`);
  return NextResponse.json({ success: true });
}
